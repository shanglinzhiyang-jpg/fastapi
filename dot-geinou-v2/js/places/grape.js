// グレープカンパニー（東京）: 1F オフィシャルストア / 2F 事務所 / 稽古場.
//
// - 1F ストア: グッズ（タオル・Tシャツは何度でも使える1日1回バフ）、カプセルトイ、店長の手伝い（tier0）
// - 2F 事務所: オーディション（コント演技）、マネージャー（事務所ライブ / 単独ライブ）、
//   営業（地方営業 / 全国ツアー）、テレビのプロデューサー（コント番組）、所属祝い・単独ライブ成功の祝賀イベント
// - 稽古場: コント演技レッスン / 漫才レッスン、若手コンビのコント稽古（見学で1日1回お笑い+1）
//
// All ids / flags are prefixed with "grape_". Every character is fictional.

import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { defineTile, tileImage, R, P, speckle, disc } from '../engine/tiles.js';
import { registerItem, ITEMS } from '../engine/state.js';
import { registerSong } from '../engine/audio.js';
import { text } from '../engine/draw.js';
import { W, H, TILE, shade, hash2, pick } from '../engine/util.js';

// ====================================================================== palette & tiles
const PU = '#8e5cc0';
const PU_D = '#5e3591';
const PU_DD = '#3e2166';
const PU_L = '#c3a0e6';
const GOLD = '#ffd23f';
const WHITE = '#faf7fd';

function shadowE(c, cx, cy, rx) {
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.fillRect(cx - rx, cy, rx * 2, 1);
  c.fillRect(cx - rx + 1, cy + 1, rx * 2 - 2, 1);
}

// ---- store walls (2 tiles tall: upper with a lighting rail, lower with chair rail + baseboard)
defineTile('grape_wall_hi', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, PU);
    R(c, 0, 0, 16, 1, shade(PU, 0.35));
    R(c, 0, 1, 16, 1, shade(PU, 0.15));
    for (let x = 1; x < 16; x += 4) R(c, x, 4, 1, 12, shade(PU, -0.07));
    R(c, 0, 3, 16, 1, '#2a2d36');
  },
});
defineTile('grape_wall', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, PU);
    for (let x = 1; x < 16; x += 4) R(c, x, 0, 1, 10, shade(PU, -0.07));
    R(c, 0, 10, 16, 1, shade(PU, 0.3));
    R(c, 0, 11, 16, 2, PU_D);
    R(c, 0, 13, 16, 3, PU_DD);
    R(c, 0, 13, 16, 1, '#2a1647');
  },
});
defineTile('grape_spot', {
  solid: true, obj: true,
  draw(c) {
    R(c, 5, 4, 6, 4, '#20232a'); R(c, 6, 5, 4, 2, '#3b3f48');
    R(c, 6, 8, 4, 1, '#fff6a8');
    c.fillStyle = 'rgba(255,246,190,0.22)';
    for (let i = 0; i < 7; i++) c.fillRect(6 - i, 9 + i, 4 + i * 2, 1);
  },
});
defineTile('grape_towel_wall', {
  solid: true, obj: true,
  draw(c) {
    // two muffler towels pinned flat on the wall, one above the other
    const towel = (y, base, ink) => {
      R(c, 1, y, 14, 5, base);
      R(c, 1, y, 14, 1, shade(base, 0.2)); R(c, 1, y + 4, 14, 1, shade(base, -0.25));
      for (let k = 0; k < 5; k += 2) { P(c, 0, y + k, base); P(c, 15, y + k, base); } // fringe
      for (let x = 2; x < 6; x += 2) R(c, x, y + 2, 1, 1, ink);
      disc(c, 8, y + 2, 1, ink); P(c, 8, y + 2, base);
      for (let x = 11; x < 15; x += 2) R(c, x, y + 2, 1, 1, ink);
      P(c, 7, y - 1, '#c3c6ce'); // pin
    };
    towel(2, PU_D, '#ffffff');
    towel(8, '#f6f6f8', PU);
  },
});
defineTile('grape_poster', {
  solid: true, obj: true, variants: 3,
  draw(c, r, f, v) {
    const bg = [PU_D, '#20232a', '#f6f6f8'][v];
    const ink = [GOLD, PU_L, PU][v];
    R(c, 3, 1, 10, 12, '#20232a'); R(c, 4, 2, 8, 10, bg);
    disc(c, 8, 5, 2, ink); P(c, 8, 5, bg);
    R(c, 5, 8, 6, 1, ink); R(c, 5, 10, 4, 1, v === 2 ? '#20232a' : '#ffffff');
  },
});
defineTile('grape_wallshelf', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 5, 16, 1, '#f6f6f8'); R(c, 0, 6, 16, 1, '#7d8391');
    R(c, 0, 11, 16, 1, '#f6f6f8'); R(c, 0, 12, 16, 1, '#7d8391');
    R(c, 2, 2, 3, 3, '#ffffff'); R(c, 2, 3, 3, 1, PU); P(c, 5, 3, '#ffffff');
    R(c, 8, 1, 2, 4, '#bfe6ff'); R(c, 8, 2, 2, 2, PU_L);
    R(c, 12, 2, 3, 3, PU_D); P(c, 13, 3, GOLD);
    R(c, 1, 8, 4, 3, PU); R(c, 1, 8, 4, 1, PU_L);
    R(c, 6, 7, 2, 4, '#bfe6ff'); R(c, 6, 8, 2, 2, GOLD);
    R(c, 10, 8, 5, 3, '#20232a'); R(c, 11, 9, 3, 1, PU_L);
  },
});
defineTile('grape_floor', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#f7f3fb');
    R(c, 0, 0, 8, 8, '#f1eaf8'); R(c, 8, 8, 8, 8, '#f1eaf8');
    R(c, 0, 0, 16, 1, '#e3d8ef'); R(c, 0, 0, 1, 16, '#e3d8ef');
    speckle(c, r, ['#e9e0f3'], 4);
  },
});
defineTile('grape_shelf', {
  solid: true, obj: true, variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, PU_D); R(c, 1, 1, 14, 14, WHITE);
    const sets = [[PU, '#ffffff', GOLD], ['#20232a', PU_L, '#ffffff'], [PU_D, '#bfe6ff', PU_L]][v];
    for (let row = 0; row < 3; row++) {
      R(c, 1, 5 + row * 5, 14, 1, PU_DD);
      for (let i = 0; i < 4; i++) R(c, 2 + i * 3 + (row % 2), 1 + row * 5 + (i % 2), 2, 4 - (i % 2), sets[(i + row) % 3]);
    }
    R(c, 0, 15, 16, 1, PU_DD);
  },
});
defineTile('grape_rack', {
  solid: true, obj: true, variants: 2,
  draw(c, r, f, v) {
    shadowE(c, 8, 14, 7);
    R(c, 0, 2, 16, 1, '#9aa0aa'); R(c, 1, 2, 1, 12, '#9aa0aa'); R(c, 14, 2, 1, 12, '#9aa0aa');
    R(c, 0, 14, 3, 1, '#5a5f6b'); R(c, 13, 14, 3, 1, '#5a5f6b');
    const cols = v ? ['#f6f6f8', PU, '#20232a'] : [PU, '#20232a', PU_L];
    R(c, 3, 4, 2, 8, cols[2]); R(c, 11, 4, 2, 8, cols[1]);
    const s = cols[0];
    R(c, 5, 4, 6, 8, s); R(c, 3, 4, 2, 3, s); R(c, 11, 4, 2, 3, s);
    R(c, 7, 3, 2, 1, '#20232a'); R(c, 7, 4, 2, 1, shade(s, -0.25));
    disc(c, 8, 7, 1, s === PU ? '#ffffff' : PU);
    R(c, 5, 11, 6, 1, shade(s, -0.25));
  },
});
defineTile('grape_table', {
  solid: true, obj: true, variants: 2,
  draw(c, r, f, v) {
    shadowE(c, 8, 14, 7);
    R(c, 0, 6, 16, 6, WHITE); R(c, 0, 6, 16, 1, '#ffffff');
    R(c, 0, 12, 16, 2, PU_D); R(c, 1, 14, 2, 1, PU_DD); R(c, 13, 14, 2, 1, PU_DD);
    const a = v ? PU : '#20232a';
    R(c, 1, 3, 6, 5, a); R(c, 1, 3, 6, 1, v ? PU_L : '#3b3f48'); R(c, 1, 5, 6, 1, shade(a, -0.25));
    R(c, 9, 4, 6, 4, v ? '#f6f6f8' : PU_D); R(c, 9, 4, 6, 1, '#ffffff'); R(c, 9, 6, 6, 1, v ? '#d5d9e0' : PU_DD);
    R(c, 7, 1, 2, 6, '#bfe6ff'); R(c, 7, 2, 2, 3, v ? GOLD : PU_L);
  },
});
function purpleCounter(c) {
  R(c, 0, 1, 16, 7, WHITE); R(c, 0, 1, 16, 1, '#ffffff');
  R(c, 0, 8, 16, 8, PU); R(c, 0, 8, 16, 1, PU_D); R(c, 0, 12, 16, 1, PU_L); R(c, 0, 15, 16, 1, PU_DD);
}
defineTile('grape_counter', { solid: true, obj: true, talkThrough: true, draw(c) { purpleCounter(c); } });
defineTile('grape_register', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    purpleCounter(c);
    R(c, 2, 0, 9, 6, '#3b3f48'); R(c, 3, 1, 7, 2, '#5ee07a'); R(c, 3, 4, 7, 1, '#9aa0aa');
    R(c, 12, 3, 3, 3, '#ffffff'); R(c, 12, 4, 3, 1, PU);
  },
});
defineTile('grape_gacha', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 14, 6);
    R(c, 3, 8, 10, 7, PU); R(c, 3, 8, 10, 1, PU_L); R(c, 3, 14, 10, 1, PU_DD);
    R(c, 6, 10, 4, 3, '#20232a'); disc(c, 8, 11, 1, '#c9ccd4');
    R(c, 4, 0, 8, 8, '#20232a'); R(c, 5, 1, 6, 7, '#dff3ff');
    for (const [x, y, col] of [[5, 5, '#ff7eb6'], [7, 6, GOLD], [9, 5, '#5fd7ff'], [6, 3, PU], [9, 2, '#5ee07a'], [8, 4, '#ff8a3d']]) R(c, x, y, 2, 2, col);
    R(c, 5, 1, 1, 3, '#ffffff');
  },
});
defineTile('grape_stairs_up', {
  draw(c) {
    R(c, 0, 0, 16, 16, PU_DD);
    for (let i = 0; i < 4; i++) { R(c, 1, i * 4, 14, 3, shade(PU_L, -i * 0.12)); R(c, 1, i * 4 + 3, 14, 1, PU_D); }
    R(c, 0, 0, 1, 16, '#c9a227'); R(c, 15, 0, 1, 16, '#c9a227');
  },
});
defineTile('grape_stairs_down', {
  draw(c) {
    R(c, 0, 0, 16, 16, PU_DD);
    for (let i = 0; i < 4; i++) { R(c, 1, i * 4, 14, 3, shade(PU_L, -(3 - i) * 0.15)); R(c, 1, i * 4 + 3, 14, 1, PU_DD); }
    R(c, 0, 0, 1, 16, '#c9a227'); R(c, 15, 0, 1, 16, '#c9a227');
  },
});

// ---- office
const OW = '#ece4f4';
defineTile('grape_owall_hi', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, OW); R(c, 0, 0, 16, 1, '#ffffff'); R(c, 0, 1, 16, 1, '#d9cde8'); },
});
defineTile('grape_owall', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, OW);
    R(c, 0, 6, 16, 2, PU); R(c, 0, 6, 16, 1, PU_L);
    R(c, 0, 13, 16, 3, PU_D); R(c, 0, 13, 16, 1, PU_DD);
  },
});
defineTile('grape_aircon', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 4, 14, 7, '#f6f6f8'); R(c, 1, 4, 14, 1, '#ffffff');
    R(c, 2, 9, 12, 1, '#c3c6ce'); R(c, 2, 10, 12, 1, '#9aa0aa'); P(c, 13, 6, '#5ee07a');
    R(c, 1, 11, 14, 1, '#b8bcc6');
  },
});
defineTile('grape_carpet', {
  draw(c, r) { R(c, 0, 0, 16, 16, '#a99fbb'); speckle(c, r, ['#9f95b1', '#b3a9c5'], 18); },
});
defineTile('grape_judge_table', {
  solid: true, obj: true, talkThrough: true, variants: 2,
  draw(c, r, f, v) {
    shadowE(c, 8, 14, 8);
    R(c, 0, 4, 16, 6, WHITE); R(c, 0, 4, 16, 1, '#ffffff');
    R(c, 0, 10, 16, 4, PU_D); R(c, 0, 10, 16, 1, PU_DD); R(c, 0, 12, 16, 1, PU);
    R(c, 2, 5, 5, 3, '#ffffff'); R(c, 3, 6, 3, 1, '#9aa0aa');
    R(c, 9, 2, 5, 4, v ? GOLD : '#ffffff'); R(c, 9, 5, 5, 1, '#c3c6ce'); R(c, 10, 3, 3, 1, '#20232a');
  },
});
defineTile('grape_desk_pc', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    shadowE(c, 8, 14, 7);
    R(c, 0, 4, 16, 6, '#7a5236'); R(c, 0, 4, 16, 1, '#9b6a46'); R(c, 0, 10, 16, 3, '#5a3a20');
    R(c, 3, 0, 9, 6, '#20232a'); R(c, 4, 1, 7, 4, '#5fd7ff'); R(c, 5, 2, 2, 1, '#ffffff'); R(c, 7, 6, 2, 1, '#20232a');
  },
});
defineTile('grape_desk_papers', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    shadowE(c, 8, 14, 7);
    R(c, 0, 4, 16, 6, '#7a5236'); R(c, 0, 4, 16, 1, '#9b6a46'); R(c, 0, 10, 16, 3, '#5a3a20');
    R(c, 2, 5, 6, 3, '#ffffff'); R(c, 3, 6, 4, 1, '#9aa0aa'); R(c, 3, 3, 5, 2, '#f2f2f2');
    R(c, 10, 3, 3, 4, PU); R(c, 10, 3, 3, 1, PU_L); R(c, 13, 4, 1, 2, PU);
  },
});
defineTile('grape_sofa', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 14, 8);
    R(c, 0, 2, 16, 6, PU_D); R(c, 0, 2, 16, 1, PU);
    R(c, 0, 7, 16, 6, PU); R(c, 0, 7, 16, 1, PU_L); R(c, 7, 7, 1, 6, PU_D);
    R(c, 0, 13, 16, 1, PU_DD);
  },
});

defineTile('grape_copier', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 14, 7);
    R(c, 1, 5, 14, 9, '#d5d9e0'); R(c, 1, 5, 14, 1, '#f2f2f2'); R(c, 1, 13, 14, 1, '#9aa0aa');
    R(c, 2, 2, 12, 4, '#c3c6ce'); R(c, 2, 2, 12, 1, '#e8eaee'); R(c, 4, 1, 8, 1, '#ffffff');
    R(c, 3, 8, 6, 2, '#9aa0aa'); R(c, 10, 7, 3, 2, '#3b3f48'); P(c, 11, 7, '#5ee07a');
    R(c, 3, 11, 10, 1, '#ffffff');
  },
});

// ---- rehearsal room (稽古場)
const KW = '#efe6d6';
defineTile('grape_kwall_hi', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, KW); R(c, 0, 0, 16, 1, '#ffffff'); R(c, 0, 1, 16, 1, '#e0d4bf'); },
});
defineTile('grape_kwall', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, KW);
    R(c, 0, 8, 16, 5, '#b98552'); R(c, 0, 8, 16, 1, '#d6a06a');
    for (let x = 3; x < 16; x += 4) R(c, x, 9, 1, 4, '#a0703f');
    R(c, 0, 13, 16, 3, '#6e4428');
  },
});
defineTile('grape_mirror_hi', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 3, 16, 13, '#9aa0aa'); R(c, 1, 4, 14, 12, '#cfe8f5');
    R(c, 3, 6, 2, 6, '#eef8ff'); R(c, 6, 5, 1, 4, '#eef8ff');
    R(c, 0, 3, 16, 1, '#c3c6ce');
  },
});
defineTile('grape_mirror_lo', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 12, '#9aa0aa'); R(c, 1, 0, 14, 11, '#cfe8f5');
    R(c, 9, 2, 2, 5, '#eef8ff'); R(c, 2, 9, 12, 1, '#bcd9e8');
    R(c, 0, 11, 16, 1, '#6d7078');
  },
});
// a painted "convenience store" set built against the wall (fictional colours, no real chain)
function setStripe(c) { R(c, 0, 0, 16, 4, '#2f9a4a'); R(c, 0, 2, 16, 1, '#ff8a3d'); R(c, 0, 4, 16, 1, '#2f6fd0'); }
function setShelves(c, y0) {
  const cols = ['#d62f2f', '#ffd23f', '#5fd7ff', '#ff7eb6', '#5ee07a'];
  for (let row = 0; row < 2; row++) {
    const y = y0 + row * 5;
    R(c, 1, y + 4, 14, 1, '#9aa0aa');
    for (let i = 0; i < 4; i++) R(c, 2 + i * 3, y + 1 + (i % 2), 2, 3 - (i % 2), cols[(i + row * 2) % 5]);
  }
}
defineTile('grape_set_hi', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#f4f8ff'); setStripe(c); setShelves(c, 5); R(c, 15, 0, 1, 16, '#dde6f2'); },
});
defineTile('grape_set_lo', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#f4f8ff'); setShelves(c, 0); R(c, 15, 0, 1, 14, '#dde6f2'); R(c, 0, 12, 16, 4, '#8a5a33'); R(c, 0, 12, 16, 1, '#a8733f'); },
});
defineTile('grape_set_door_hi', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#f4f8ff'); setStripe(c); R(c, 1, 6, 14, 10, '#5a5f6b'); R(c, 2, 7, 12, 9, '#a8dcf5'); R(c, 7, 7, 2, 9, '#5a5f6b'); R(c, 3, 8, 2, 5, '#e0f4ff'); },
});
defineTile('grape_set_door_lo', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#f4f8ff'); R(c, 1, 0, 14, 12, '#5a5f6b'); R(c, 2, 0, 12, 12, '#a8dcf5'); R(c, 7, 0, 2, 12, '#5a5f6b'); R(c, 0, 12, 16, 4, '#8a5a33'); R(c, 0, 12, 16, 1, '#a8733f'); },
});
defineTile('grape_set_counter', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 3, 16, 5, '#f6f6f8'); R(c, 0, 3, 16, 1, '#ffffff');
    R(c, 0, 8, 16, 6, '#2f6fd0'); R(c, 0, 8, 16, 1, '#2a5ab0'); R(c, 0, 11, 16, 1, '#ff8a3d'); R(c, 0, 14, 16, 1, '#8a5a33');
    R(c, 3, 4, 3, 2, '#ffd23f'); R(c, 8, 4, 4, 3, '#d62f2f');
  },
});
defineTile('grape_set_register', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 3, 16, 5, '#f6f6f8'); R(c, 0, 3, 16, 1, '#ffffff');
    R(c, 0, 8, 16, 6, '#2f6fd0'); R(c, 0, 8, 16, 1, '#2a5ab0'); R(c, 0, 11, 16, 1, '#ff8a3d'); R(c, 0, 14, 16, 1, '#8a5a33');
    R(c, 3, 0, 9, 6, '#c9955a'); R(c, 4, 1, 7, 2, '#5ee07a'); R(c, 4, 4, 7, 1, '#ddb07a');
  },
});
defineTile('grape_tape', {
  obj: true, variants: 2,
  draw(c, r, f, v) { const col = v ? '#ffd23f' : '#ff7eb6'; R(c, 5, 8, 6, 1, col); R(c, 7, 6, 2, 1, col); R(c, 7, 9, 2, 1, col); },
});
defineTile('grape_propbox', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 14, 7);
    R(c, 1, 6, 14, 8, '#c9955a'); R(c, 1, 6, 14, 2, '#ddb07a'); R(c, 1, 13, 14, 1, '#9b6c3c');
    R(c, 2, 1, 5, 3, '#d62f2f'); R(c, 2, 1, 5, 1, '#ff5d6c'); R(c, 4, 4, 1, 3, '#ffd23f');
    disc(c, 11, 4, 2, '#ff8a3d'); R(c, 8, 5, 3, 1, '#20232a');
    R(c, 5, 9, 6, 2, '#ffffff'); R(c, 6, 9, 4, 1, '#20232a');
  },
});
defineTile('grape_proptable', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 14, 7);
    R(c, 1, 6, 14, 5, '#c48a52'); R(c, 1, 6, 14, 1, '#dca26a'); R(c, 1, 11, 14, 2, '#8a5a33');
    R(c, 2, 13, 2, 2, '#5a3a20'); R(c, 12, 13, 2, 2, '#5a3a20');
    R(c, 3, 3, 4, 3, '#20232a'); R(c, 2, 6, 6, 1, '#20232a');
    disc(c, 11, 5, 2, '#e8c45a'); R(c, 9, 8, 2, 1, '#20232a'); R(c, 12, 8, 2, 1, '#20232a'); R(c, 11, 8, 1, 1, '#20232a');
  },
});
defineTile('grape_bench', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 13, 8);
    R(c, 0, 6, 16, 4, '#b98552'); R(c, 0, 6, 16, 1, '#d6a06a'); R(c, 0, 10, 16, 1, '#8a5a33');
    R(c, 1, 11, 2, 3, '#6e4428'); R(c, 13, 11, 2, 3, '#6e4428');
  },
});
defineTile('grape_mat', {
  draw(c) { R(c, 0, 0, 16, 16, PU_DD); R(c, 1, 1, 14, 14, PU_D); for (let y = 3; y < 14; y += 3) R(c, 2, y, 12, 1, PU); },
});

// ====================================================================== items & music
registerItem('grape_towel', {
  name: 'グレープタオル', price: 3000,
  desc: '紫のマフラータオル。何度でも使える！1日1回、次の「お笑い」が少しやさしくなる。',
  use: (g) => useGoods(g, 'grape_towel_day', 'warai', 'グレープタオルを首にかけた！\n気合いが入った！次の「お笑い」のミニゲームが少しやさしくなる。'),
});
registerItem('grape_tshirt', {
  name: 'ロゴTシャツ', price: 4000,
  desc: 'ロゴ入りのTシャツ。何度でも使える！1日1回、次の「演技」が少しやさしくなる。',
  use: (g) => useGoods(g, 'grape_tshirt_day', 'engi', 'ロゴTシャツに着がえた！\n役に入りやすくなった！次の「演技」のミニゲームが少しやさしくなる。'),
});
registerItem('grape_juice', { name: 'ぶどうジュース', price: 250, desc: 'あまずっぱいぶどうジュース。体力が20回復する。', heal: 20 });
registerItem('grape_badge', {
  name: '金ぶどう缶バッジ', price: 0,
  desc: 'カプセルトイのレア景品。1日1回ながめると、体力が10回復する。',
  use: async (g) => {
    if (g.flag('grape_badge_day') === g.state.day) { await g.say('金色の缶バッジがキラリと光った。\n（今日はもう元気をもらった）'); return; }
    if (g.state.stamina >= g.state.maxStamina) { await g.say('体力は満タンだ。\n缶バッジは大事にしまっておこう。'); return; }
    g.setFlag('grape_badge_day', g.state.day);
    g.heal(10);
    g.sfx('good');
    await g.say('金ぶどう缶バッジをながめた。\n…なんだか元気が出てきた！体力が10回復した。');
  },
});
registerItem('grape_plaque', {
  name: '単独ライブ記念盾', price: 0,
  desc: '単独ライブ大成功の記念にもらった盾。見るたびに初心を思い出す。',
  use: async (g) => { g.sfx('chime'); await g.say(['記念の盾をながめた。', '「祝・単独ライブ大成功」…\nあの日の大歓声が、今も耳に残っている。']); },
});

async function useGoods(g, dayFlag, skill, msg) {
  if (g.state.buffs[skill]) { await g.say('もう気合いは十分だ！\nこの効果はミニゲームで使うまで続く。'); return; }
  if (g.flag(dayFlag) === g.state.day) { await g.say('今日はもう使った。\nグッズはまた明日も使えるぞ。'); return; }
  g.setFlag(dayFlag, g.state.day);
  g.state.buffs[skill] = true;
  g.sfx('good');
  await g.say(msg);
}

registerSong('grape_store', {
  bpm: 126, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'G4 . B4 D5 G5 . F#5 E5 | D5 . B4 . G4 . A4 B4 | C5 . E5 . G5 . E5 C5 | D5 - - . . . . . | G4 . B4 D5 G5 . A5 B5 | C6 . B5 A5 G5 . E5 . | A4 . C5 E5 D5 . C5 A4 | G4 - - . . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'G2 . D3 . G2 . D3 . | G2 . D3 . G2 . D3 . | C3 . G3 . C3 . G3 . | D3 . A3 . D3 . F#3 . | G2 . D3 . G2 . D3 . | C3 . G3 . C3 . G3 . | D3 . A3 . D3 . A3 . | G2 . D3 . G2 . . .' },
    { wave: 'drum', vol: 0.08, notes: 'k . h . s . h h | k . h k s . h .' },
  ],
});

// ====================================================================== characters
const C = {
  // 1F store
  clerk: { name: 'レジのスタッフ', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#7d4cb0', bottom: '#2a2430' } },
  tencho: { name: '店長', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: PU_D, bottom: '#3b3f48', glasses: true } },
  stairs: { name: 'スタッフ', look: { ...LOOKS.staff, hat: '#7d4cb0', top: PU_D } },
  fan: { name: 'お笑いファン', look: { ...LOOKS.fan, hairColor: 'black', top: PU_L } },
  student: { name: '修学旅行生', look: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#f2f2f2', bottom: '#3a4a7a' } },
  kid: { name: 'こども', look: { ...LOOKS.kid, top: PU } },
  // 2F office
  reception: { name: '受付さん', look: { ...LOOKS.receptionist, top: '#6a3d9a', bottom: '#2a2430' } },
  manager: { name: 'マネージャー紫藤', look: { ...LOOKS.manager, tie: PU } },
  chief: { name: 'チーフマネージャー', look: { hair: 'long', hairColor: 'black', skin: 'light', top: '#2e3140', bottom: '#2e3140', jacket: true, skirt: true, glasses: true } },
  eigyo: { name: '営業の房田さん', look: { hair: 'spiky', hairColor: 'black', skin: 'tan', top: '#3b3f48', bottom: '#3b3f48', jacket: true, tie: GOLD } },
  jimu: { name: '事務スタッフ', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: PU_L, bottom: '#5a4a6a', skirt: true } },
  producer: { name: 'テレビのプロデューサー', look: { hair: 'cap', hat: '#20232a', hairColor: 'black', skin: 'fair', top: '#ff8a3d', bottom: '#3a4a7a', glasses: 'sun' } },
  wakate: { name: '若手芸人', look: { ...LOOKS.comedian, top: PU, bottom: '#20232a' } },
  // 稽古場
  fujidana: { name: 'コント作家 藤棚先生', look: { hair: 'afro', hairColor: 'black', skin: 'fair', top: '#f2f2f2', bottom: '#5a4a3a', glasses: true, beard: true } },
  tsubuta: { name: '漫才講師 粒田先生', look: { hair: 'slick', hairColor: 'silver', skin: 'tan', top: PU_D, bottom: '#20232a', jacket: true } },
  maruo: { name: 'たてお（店員役）', look: { hair: 'bald', hairColor: 'black', skin: 'fair', top: '#2f9a4a', bottom: '#3b3f48' } },
  kakuta: { name: 'よこた（客役）', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#3a4a7a', bottom: '#20232a', glasses: true } },
  kodougu: { name: '小道具さん', look: { ...LOOKS.staff, hat: GOLD, top: '#5a6f8a' } },
  mirror: { name: '若手ピン芸人', look: { hair: 'twin', hairColor: 'brown', skin: 'light', top: '#ff7eb6', bottom: '#3a4a7a' } },
};

const say = (g, who, t) => g.say(t, { name: C[who].name, look: C[who].look });
const ask = (g, who, t, choices, opts = {}) => g.ask(t, choices, { name: C[who].name, look: C[who].look, ...opts });

function npc(id, x, y, dir, extra = {}) {
  return { type: 'npc', id, x, y, dir, name: C[id].name, look: C[id].look, ...extra };
}

const isMember = (g) => g.state.agency === 'grape';
const today = (g, k) => g.flag(k) === g.state.day;
const lockLabel = (g, label, req) => (g.checkRequires(req) && req.fame && g.state.fame < req.fame ? `${label}★${req.fame}` : label);

// ====================================================================== minigame content
const LIVE_LINES = [
  { boke: 'どうもー！よろしくお願いします！', punch: false },
  { boke: '最近、健康のために毎朝走ってるんです。', punch: false },
  { boke: '家から冷蔵庫まで。', punch: true, tsukkomi: '近すぎるだろ！' },
  { boke: '将来はビッグになりたいんですよ。', punch: false },
  { boke: 'なので毎日、牛乳を3リットル飲んでます。', punch: true, tsukkomi: 'そっちのビッグじゃない！' },
  { boke: '最近、料理を始めたんです。', punch: false },
  { boke: '得意料理は、氷です。', punch: true, tsukkomi: '凍らせただけだろ！' },
  { boke: '今日はお客さんがいっぱいでうれしいです！', punch: false },
  { boke: 'なんと、7人も！', punch: true, tsukkomi: 'いっぱいじゃないだろ！' },
];
const TOUR_LINES = [
  { boke: '全国ツアー、ついに始まりました！', punch: false },
  { boke: '各地の名物を食べるのが楽しみで。', punch: false },
  { boke: '北海道ではカニ、大阪ではたこ焼き。', punch: false },
  { boke: 'そして沖縄では、家から持ってきたおにぎり。', punch: true, tsukkomi: '最後に手を抜くな！' },
  { boke: '移動はもちろん新幹線です。', punch: false },
  { boke: '新幹線を、走って追いかけます。', punch: true, tsukkomi: '乗れよ！' },
  { boke: 'ホテルの枕が変わると眠れないんです。', punch: false },
  { boke: 'だから家から布団ごと持ってきました。', punch: true, tsukkomi: '荷物が多すぎる！' },
  { boke: 'お土産もたくさん買いました。', punch: false },
  { boke: '全部、自分用です。', punch: true, tsukkomi: '配れよ！' },
  { boke: 'ツアーの目標は、全国のみなさんを笑顔に！', punch: false },
  { boke: 'あと、ご当地キャラと全員友だちに。', punch: true, tsukkomi: '目標がずれてる！' },
];
const LESSON_LINES = [
  { boke: '先生、今日はよろしくお願いします！', punch: false },
  { boke: 'ぼく、ペットを飼ってるんです。', punch: false },
  { boke: '名前は「ポチ」。ネコです。', punch: true, tsukkomi: '犬の名前だろ！' },
  { boke: '朝ごはんは、パン派なんです。', punch: false },
  { boke: 'パンに、ごはんをのせて食べます。', punch: true, tsukkomi: 'どっちかにしろ！' },
  { boke: '今日はいい天気ですね。', punch: false },
  { boke: 'なので、てるてる坊主を逆さに吊るしてきました。', punch: true, tsukkomi: '雨を降らせる気か！' },
];
const ADV_LINES = [
  { boke: '先生、ぼく最近、早起きしてるんです。', punch: false },
  { boke: '目覚ましを10個かけて、全部止めてから寝てます。', punch: true, tsukkomi: '起きてないだろ！' },
  { boke: '休みの日は、図書館に行くんです。', punch: false },
  { boke: '本は読まずに、においだけかいで帰ります。', punch: true, tsukkomi: '読めよ！' },
  { boke: 'きのう、道で百円を拾ったんです。', punch: false },
  { boke: 'ちゃんと交番に届けました。', punch: false },
  { boke: 'お礼に、おまわりさんと記念写真を。', punch: true, tsukkomi: '観光客か！' },
  { boke: '将来の夢は、パイロットです。', punch: false },
  { boke: '練習で、紙飛行機を毎日飛ばしてます。', punch: true, tsukkomi: '規模が小さい！' },
];
// コント scenes for the acting minigame. Beats: W 笑う / N 泣く / O 怒る / D 驚く / K キメ / T 照れる.
const CONTE_SCENES = [
  { title: 'コンビニの新人店員', beats: 'WDTNOWDK' },
  { title: 'ポンコツ探偵', beats: 'KDOWNDTK' },
  { title: '職員室の先生', beats: 'OTDWNOWK' },
  { title: 'お見合い大作戦', beats: 'TWDTNOWK' },
  { title: '宇宙人と遭遇', beats: 'DDOWTNWK' },
  { title: '下町のラーメン屋', beats: 'OWDNTWOK' },
];
// a few random コント scenes; the minigame fills the remaining rounds with its own (shuffled) scenes
function conteScenes(n) {
  const a = CONTE_SCENES.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
// 芸の実演 (C): the practice room as a venue for the lessons (performance model in perform.js)
const V_KEIKO = { name: 'グレープ 稽古場', size: 'small', crowd: 'warm', pressure: 5 };
const PARTNER = { partner: '相方', partnerLook: { hair: 'short', hairColor: 'black', skin: 'fair', top: PU, bottom: '#20232a' } };

const CHIHO_SCENES = [
  {
    prompt: '司会「この町に来るのは初めてですか？」',
    answers: [
      { text: 'はい！駅からもう楽しいです', score: 100 },
      { text: '帰りの電車は何時ですか', score: 10 },
      { text: '…はい。', score: 30 },
    ],
  },
  {
    prompt: '司会「この町の名物、もう食べました？」',
    answers: [
      { text: 'まだです！おすすめは？', score: 100 },
      { text: 'ダイエット中なので…', score: 20 },
      { text: '楽屋のお弁当なら食べました', score: 60 },
    ],
  },
  {
    prompt: 'おばあちゃん「テレビで見たことないねえ」',
    answers: [
      { text: '今日から覚えてください！', score: 100 },
      { text: '…ですよねえ', score: 30 },
      { text: 'テレビ見てないんですか？', score: 10 },
    ],
  },
  {
    prompt: 'こども「なんかおもしろいことやって！」',
    answers: [
      { text: 'よし、とっておきのギャグ！', score: 100 },
      { text: 'また今度ね', score: 10 },
      { text: 'じゃあキミがやってみて', score: 50 },
    ],
  },
  {
    prompt: '司会「最後にひとこと、お願いします！」',
    answers: [
      { text: 'また絶対に来ます！', score: 100 },
      { text: 'つかれました', score: 0 },
      { text: 'お土産を買って帰ります', score: 60 },
    ],
  },
];

// ====================================================================== activities
const JOBS = {
  store: {
    id: 'grape_store_help', title: 'ストアの手伝い', client: C.tencho.name, clientLook: C.tencho.look,
    desc: '店頭でノリノリの呼び込みダンス！', stamina: 15,
    minigame: 'command', opts: { theme: 'dance', difficulty: 1 },
    pay: 900, fame: 4, skill: 'uta', gain: 1,
  },
  live: {
    id: 'grape_office_live', title: '事務所ライブ出演', client: C.manager.name, clientLook: C.manager.look,
    desc: '所属芸人が集まるお笑いライブ！', stamina: 20,
    minigame: 'manzai', opts: { difficulty: 2, lines: LIVE_LINES, ...PARTNER, dialect: 'std', venue: { name: 'グレープ 事務所ライブ', size: 'theater', crowd: 'warm', pressure: 20 } },
    pay: 4500, fame: 18, skill: 'warai', gain: 2, requires: { agency: 'grape' },
  },
  chiho: {
    id: 'grape_chiho', title: '地方営業', client: C.eigyo.name, clientLook: C.eigyo.look,
    desc: '地方のショッピングモールでトークショー！', stamina: 25,
    minigame: 'talk', opts: { difficulty: 2, topic: 'ショッピングモールでトークショー', scenes: CHIHO_SCENES },
    pay: 4000, fame: 15, skill: 'talk', gain: 2, requires: { agency: true },
  },
  conte: {
    id: 'grape_conte_tv', title: 'コント番組', client: C.producer.name, clientLook: C.producer.look,
    desc: 'テレビのコント番組に出演！', stamina: 25,
    minigame: 'conte', get opts() { return { difficulty: 3, scenes: conteScenes(3), venue: { name: 'コント番組の収録', size: 'tv', crowd: 'normal', pressure: 50 } }; },
    pay: 12000, fame: 45, skill: 'engi', gain: 3, requires: { fame: 250 },
  },
  tour: {
    id: 'grape_tour', title: '全国ツアー', client: C.eigyo.name, clientLook: C.eigyo.look,
    desc: '全国の劇場をまわるお笑いツアー！', stamina: 30,
    minigame: 'manzai', opts: { difficulty: 4, lines: TOUR_LINES, ...PARTNER, dialect: 'std', venue: { name: '全国ツアー', size: 'hall', crowd: 'warm', pressure: 45 } },
    pay: 30000, fame: 120, skill: 'warai', gain: 4, requires: { fame: 1000 },
  },
  solo: {
    id: 'grape_solo_live', title: '単独ライブ', client: C.manager.name, clientLook: C.manager.look,
    desc: '{name}の単独ライブ！大ホールが満員だ！', stamina: 30,
    minigame: 'conte', get opts() { return { difficulty: 5, scenes: conteScenes(4), venue: { name: '単独ライブ', size: 'hall', crowd: 'warm', pressure: 55 } }; },
    pay: 65000, fame: 250, skill: 'engi', gain: 5, requires: { agency: 'grape', fame: 2000 },
  },
};

const STORE_GOODS = ['grape_towel', 'grape_tshirt', 'grape_juice', 'drink', 'netacho'];

// ---------------------------------------------------------------- celebration effects (office)
const fx = { start: 0, text: '' };

function drawCelebration(ctx, g, cam) {
  if (!fx.start) return;
  const t = g.frame - fx.start;
  const OPEN = 50;
  const bx = Math.round(fx.x * TILE + 8 - cam.x);
  const by = 26;
  const swing = t < OPEN ? Math.round(Math.sin(t / 6) * 2) : 0;
  // string
  ctx.fillStyle = '#e8e0c8';
  ctx.fillRect(bx + swing, 0, 1, by - 12);
  if (t < OPEN) {
    // closed kusudama
    for (let y = -12; y <= 12; y++) {
      const w = Math.round(Math.sqrt(144 - y * y));
      ctx.fillStyle = y < 0 ? GOLD : '#ffb347';
      ctx.fillRect(bx + swing - w, by + y, w, 1);
      ctx.fillStyle = y < 0 ? PU_L : PU;
      ctx.fillRect(bx + swing, by + y, w, 1);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + swing, by - 12, 1, 25);
    return;
  }
  const tt = t - OPEN;
  const k = Math.min(1, tt / 10);
  // two open halves hanging from the string
  for (let y = 0; y <= 12; y++) {
    const w = Math.round(Math.sqrt(144 - y * y));
    ctx.fillStyle = GOLD;
    ctx.fillRect(bx - 4 - Math.round(k * 10) - w, by - 12 + y, w, 1);
    ctx.fillStyle = PU;
    ctx.fillRect(bx + 4 + Math.round(k * 10), by - 12 + y, w, 1);
  }
  // confetti
  const cols = [GOLD, PU_L, '#ff7eb6', '#5fd7ff', '#5ee07a', '#ffffff'];
  for (let i = 0; i < 90; i++) {
    const r1 = hash2(i, 1, 11), r2 = hash2(i, 2, 11), r3 = hash2(i, 3, 11);
    const spread = Math.min(tt, 30);
    const x = bx + (r1 - 0.5) * 7 * spread + Math.sin((tt + i * 13) / 10) * 4;
    const y = by + spread * (r3 - 0.6) * 1.4 + Math.max(0, tt - 12) * (0.5 + r2 * 0.7);
    if (y > H || x < -4 || x > W + 4) continue;
    ctx.fillStyle = cols[i % cols.length];
    if ((Math.floor(tt / 6) + i) % 2) ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    else ctx.fillRect(Math.round(x), Math.round(y), 1, 3);
  }
  // vertical banner
  const chars = Array.from(fx.text);
  const full = chars.length * 12 + 10;
  const hgt = Math.min(full, Math.round(tt * 4));
  const top = by - 6;
  ctx.fillStyle = '#d62f2f';
  ctx.fillRect(bx - 9, top, 19, hgt);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx - 7, top, 15, Math.max(0, hgt - 2));
  chars.forEach((ch, i) => {
    const cy = top + 5 + i * 12;
    if (cy + 11 > top + hgt) return;
    text(ctx, ch, bx + 1, cy, { size: 10, align: 'center', color: '#d62f2f', shadow: null });
  });
}

async function kusudama(g, x, label) {
  fx.start = g.frame;
  fx.x = x;
  fx.text = label;
  g.sfx('drum');
  await g.wait(850);
  g.sfx('fanfare');
  g.shake(8, 1);
  await g.wait(700);
  g.sfx('applause');
}

// ---------------------------------------------------------------- 1F store
async function greetStore(g) {
  g.sfx('chime');
  await g.emote('clerk', '!');
  await say(g, 'clerk', 'いらっしゃいませー！');
  await g.showLogo('grape', 'グレープカンパニー公式ストア');
  await g.say(['ここはグレープカンパニーのオフィシャルストア。', '所属芸人のグッズがずらりと並んでいる。\n奥の階段から2階の事務所へ行けるようだ。']);
}

async function talkClerk(g) {
  if (!g.flag('grape_clerk_met')) {
    g.setFlag('grape_clerk_met');
    await say(g, 'clerk', ['いらっしゃいませ！', 'タオルとTシャツは何度でも使えるんです。\n1日1回、気合いを入れたいときにどうぞ！']);
  }
  const n = await g.shop(STORE_GOODS, { title: 'オフィシャルストア', greeting: 'いらっしゃいませ！' });
  if (n > 0) await say(g, 'clerk', 'お買い上げ、ありがとうございます！\nもちもの（メニュー）から使ってくださいね。');
  else await say(g, 'clerk', 'またのお越しをお待ちしてます！');
}

async function talkTencho(g) {
  const i = await ask(g, 'tencho', ['いらっしゃい！このストアの店長です。', 'ちょうど人手が足りなくて…\nお店、手伝っていかない？'], ['手伝う', 'お店のこと', 'やめておく']);
  if (i === 0) {
    const res = await g.job(JOBS.store);
    if (res) await say(g, 'tencho', res.rank === 'S' || res.rank === 'A' ? 'すごい！お客さんが集まってきたよ！\nまた頼むね！' : 'おつかれさま！助かったよ。\nまたいつでも手伝ってね。');
  } else if (i === 1) {
    await say(g, 'tencho', [
      'ここでは所属芸人のグッズを売ってるんだ。',
      'タオルを首にかけるとお笑いに、\nTシャツを着ると演技に気合いが入るよ。',
      '2階は事務所と稽古場。\nオーディションも受けられるから、行ってみて！',
    ]);
  } else {
    await say(g, 'tencho', 'ゆっくり見ていってね！');
  }
}

async function gacha(g) {
  const i = await g.ask('カプセルトイだ。1回¥300。\n何が出るかはお楽しみ！', ['回す', 'やめておく']);
  if (i !== 0) return;
  if (!g.spend(300)) { await g.say('お金が足りない…'); return; }
  g.sfx('coin');
  await g.wait(250);
  g.sfx('cursor');
  await g.wait(250);
  g.sfx('ok');
  const r = Math.random();
  const id = r < 0.07 ? 'grape_badge' : r < 0.45 ? 'grape_juice' : r < 0.65 ? 'netacho' : r < 0.85 ? 'daihon' : 'wadai';
  if (id === 'grape_badge') {
    g.sfx('fanfare');
    await g.say('ガラガラ…ポンッ！\nなんと！レアの「金ぶどう缶バッジ」だ！');
  } else {
    await g.say(`ガラガラ…ポンッ！\n「${ITEMS[id].name}」が出てきた！`);
  }
  g.giveItem(id);
}

// ---------------------------------------------------------------- 2F office
async function welcomeCutscene(g) {
  g.setFlag('grape_welcomed');
  await g.fadeOut();
  g.placePlayer(8, 8, 'up');
  g.placeNpc('manager', 4, 7, 'right');
  g.placeNpc('reception', 6, 8, 'right');
  g.placeNpc('jimu', 10, 8, 'left');
  g.placeNpc('wakate', 7, 9, 'up');
  await g.fadeIn();
  await say(g, 'manager', 'おーい！合格した新人さんって、きみ！？');
  await g.moveNpc('manager', 'right right right right face:down', 1.5);
  await g.emote('manager', '!');
  await say(g, 'manager', [
    'はじめまして！今日から{name}さんを担当する、マネージャーの紫藤です！',
    'コントも漫才も、みんな本気で笑いを追いかけてる事務所です。\n一緒にてっぺん目指しましょう！',
  ]);
  await kusudama(g, 8, '祝所属決定');
  await g.emote('wakate', '♪');
  await say(g, 'wakate', 'ようこそグレープへ！\nライブで一緒になったら、よろしくな！');
  await g.emote('reception', '♥');
  await say(g, 'manager', 'これ、所属記念のプレゼントです！\nライブの前に首にかけてくださいね。');
  g.giveItem('grape_towel');
  await say(g, 'manager', 'お仕事の相談は、いつでもぼくのデスクへ。\n営業の房田さんにも、あいさつしておくといいですよ。');
  await g.fadeOut();
  fx.start = 0;
  await g.goto('grape', 'office', 12, 7, 'up');
}

async function soloCelebration(g) {
  await g.fadeOut();
  // the staff wait in an arc around the spot under the kusudama
  g.placePlayer(8, 10, 'up');
  g.placeNpc('manager', 8, 8, 'down');
  g.placeNpc('eigyo', 7, 8, 'down');
  g.placeNpc('chief', 9, 8, 'down');
  g.placeNpc('reception', 6, 9, 'right');
  g.placeNpc('jimu', 10, 9, 'left');
  g.placeNpc('wakate', 5, 10, 'right');
  g.placeNpc('producer', 11, 10, 'left');
  await g.fadeIn();
  g.notify('その夜、事務所にて…', { color: '#fff', life: 90 });
  await g.wait(1600); // let the caption go before the banner drops
  await say(g, 'manager', 'みなさん、主役が帰ってきましたよ！\nせーの…！');
  await kusudama(g, 8, '祝単独ライブ大成功');
  for (const id of ['reception', 'jimu', 'eigyo', 'chief', 'wakate', 'producer']) g.emote(id, pick(['!', '♪', '♥']));
  await g.say('一同「単独ライブ大成功、おめでとう！！」');
  await say(g, 'manager', ['チケットは即完売、会場は最後まで大爆笑…', '{name}さん、本当に最高のライブでした！']);
  await say(g, 'producer', 'いやあ、笑いすぎてお腹が痛いよ。\n次はぜひ、うちの特番にも！');
  await say(g, 'chief', 'オーディションの日のこと、覚えてます？\n…立派になりましたね。');
  await g.emote('player', '♥');
  await say(g, 'manager', 'これ、事務所のみんなからです！');
  g.giveItem('grape_plaque');
  g.sfx('success');
  await g.say('「単独ライブ記念盾」をもらった！\nもちもの（メニュー）から眺められる。');
  await say(g, 'manager', 'さあ、次はもっと大きな舞台ですよ！\n国民的スターまで、あと少し！');
  await g.fadeOut();
  fx.start = 0;
  await g.goto('grape', 'office', 8, 10, 'up');
}

// Later successful solo lives: a short celebration right at the manager's desk.
async function soloEncore(g) {
  await g.emote('manager', '♪');
  await say(g, 'manager', '今日も満員御礼でしたね！\nみなさーん、せーの…！');
  await kusudama(g, 8, '祝満員御礼');
  for (const id of ['reception', 'jimu', 'eigyo', 'wakate']) g.emote(id, pick(['♪', '♥']));
  await say(g, 'manager', ['{name}さんの単独ライブは、\nもう事務所の名物ですね！', '次はもっと大きな会場を押さえますよ！']);
  fx.start = 0;
}

function advice(g) {
  const st = g.state;
  const tips = [];
  if (st.fame < 250) tips.push('いまは事務所ライブで場数を踏む時期です。\n★250になればテレビのコント番組にも出られますよ。');
  else if (st.fame < 1000) tips.push('顔が売れてきましたね！\n★1000で全国ツアーの話も来ます。営業の房田さんに相談を。');
  else if (st.fame < 2000) tips.push('全国ツアーで、ファンが一気に増えましたね。\n★2000になったら…いよいよ単独ライブです！');
  else tips.push('単独ライブ、いつでもいけますよ！\n大きな会場を押さえてあります。');
  if (st.skills.engi < 30) tips.push('稽古場の藤棚先生のレッスンで、演技をみがくのもおすすめです。');
  else if (st.skills.warai < 30) tips.push('稽古場の粒田先生の漫才レッスンで、ツッコミのキレをみがきましょう。');
  return tips;
}

const FIRST_GREET = 'さっそくですが、お仕事の話をしましょうか！\n何からいきます？';

async function talkManager(g) {
  if (!isMember(g)) {
    await say(g, 'manager', [
      'マネージャーの紫藤です。所属タレントのお仕事を担当しています。',
      'うちのオーディションは、右手前の審査テーブルで受けられますよ。\n合格したら、よろしくお願いしますね！',
    ]);
    return;
  }
  if (!g.flag('grape_welcomed')) {
    await welcomeCutscene(g);
    await managerMenu(g, FIRST_GREET);
    return;
  }
  await managerMenu(g, 'おつかれさまです、{name}さん！\n今日はどうします？');
}

async function managerMenu(g, greet) {
  const choices = ['事務所ライブ', lockLabel(g, '単独ライブ', JOBS.solo.requires), '相談する', 'やめておく'];
  const i = await ask(g, 'manager', greet, choices);
  if (i === 0) {
    const res = await g.job(JOBS.live);
    if (res) await say(g, 'manager', res.success ? 'ライブ、ウケてましたね！\nこの調子でいきましょう！' : 'ドンマイ！ネタは磨けば光ります。\n稽古場で練習していきましょう。');
  } else if (i === 1) {
    const res = await g.job(JOBS.solo);
    if (!res) return;
    if (['S', 'A', 'B'].includes(res.rank)) {
      if (!g.flag('grape_solo_done')) {
        g.setFlag('grape_solo_done');
        await soloCelebration(g);
      } else {
        await soloEncore(g);
      }
    } else {
      await say(g, 'manager', ['…今日はちょっと悔しかったですね。', 'でも、お客さんの拍手は温かかった。\n次はもっといいライブにしましょう！']);
    }
  } else if (i === 2) {
    await say(g, 'manager', advice(g));
  } else {
    await say(g, 'manager', '了解です！\nお仕事の相談は、いつでもどうぞ。');
  }
}

async function talkChief(g) {
  if (isMember(g)) {
    await say(g, 'chief', g.state.fame >= 2000
      ? ['{name}さん、すっかり事務所の顔ですね。', '新人オーディションの審査員も、そのうちお願いしようかしら。']
      : ['所属タレントとして、期待していますよ。', 'お仕事はマネージャーの紫藤に。\n実力をつけたいなら、稽古場のレッスンへ。']);
    return;
  }
  const i = await ask(g, 'chief', ['グレープカンパニーの新人オーディションです。', '審査はコント演技。\n表示された動きを、テンポよく演じてください。'], ['受ける', 'コツを聞く', 'やめておく']);
  if (i === 1) {
    await say(g, 'chief', [
      '大事なのは、あわてず正確に。\nコントは間（ま）とテンポが命です。',
      '自信がなければ、稽古場の藤棚先生の\nコント演技レッスンを受けてみて。',
      '1階のストアのTシャツを着てくると、\n役に入りやすいって評判ですよ。',
    ]);
    return;
  }
  if (i !== 0) { await say(g, 'chief', 'いつでも挑戦をお待ちしています。'); return; }
  // an acting audition: the 演技 skill (and the T-shirt / 台本メモ buff) helps, not the agency's default お笑い
  await g.audition({
    agency: 'grape', title: 'オーディション（コント演技）', minigame: 'command',
    opts: { theme: 'acting', difficulty: 2, scenes: conteScenes(2) }, skill: 'engi', pass: 55, stamina: 15,
    client: C.chief.name, clientLook: C.chief.look,
  });
  const why = g.lastAudition;
  if (why === 'passed') {
    await g.emote('chief', '♪');
    if (!g.flag('grape_welcomed')) {
      await say(g, 'chief', 'すばらしいコントでした！\nあなたの担当マネージャーを紹介しますね。');
      await welcomeCutscene(g);
      await managerMenu(g, FIRST_GREET);
    } else {
      await say(g, 'chief', ['おかえりなさい、{name}さん！', 'マネージャーの紫藤も、きっと大喜びですよ。\nまたよろしくお願いしますね。']);
    }
  } else if (why === 'failed') {
    await say(g, 'chief', '惜しかったですね。\nレッスンを受けて、また来てください。');
  } else if (why === 'nostamina') {
    await say(g, 'chief', '今日はしっかり休んで、\n万全の状態でまた来てくださいね。');
  } else if (why === 'declined' || why === 'transferDeclined') {
    await say(g, 'chief', 'わかりました。\n気が変わったら、いつでもどうぞ。');
  }
}

async function talkEigyo(g) {
  const choices = ['地方営業', lockLabel(g, '全国ツアー', JOBS.tour.requires), 'やめておく'];
  const i = await ask(g, 'eigyo', ['営業の房田です！全国どこへでもお仕事を取ってきますよ！', '事務所に所属しているタレントさんなら、\n地方営業をお願いできます。'], choices);
  if (i === 0) {
    const res = await g.job(JOBS.chiho);
    if (res) await say(g, 'eigyo', '地元のみなさん、大喜びでしたよ！\nお土産のおまんじゅう、みんなで食べましょう。');
  } else if (i === 1) {
    const res = await g.job(JOBS.tour);
    if (res) await say(g, 'eigyo', '全国ツアー、おつかれさまでした！\nどの会場も満員でしたよ！');
  } else {
    await say(g, 'eigyo', 'お仕事が欲しくなったら、いつでもどうぞ！');
  }
}

async function talkProducer(g) {
  if (g.state.fame < 250) {
    await say(g, 'producer', [
      'テレビのコント番組で、新しい出演者を探してるんだ。',
      'うーん、もう少し名前が売れたら声をかけるよ。\n知名度★250くらいかな！',
    ]);
    return;
  }
  await say(g, 'producer', ['おっ、ちょうどいいところに！', 'コント番組の出演枠、ひとつ空いてるんだ。\nきみ、出てみない？']);
  const res = await g.job(JOBS.conte);
  if (!res) { await say(g, 'producer', 'そっか。気が向いたら声をかけてよ！'); return; }
  await say(g, 'producer', res.success ? 'オンエアが楽しみだよ！\n次回もよろしく！' : 'まあ、編集でなんとかするよ！\n次は期待してるからね。');
}

async function talkJimu(g) {
  if (isMember(g) && !today(g, 'grape_sashiire_day')) {
    g.setFlag('grape_sashiire_day', g.state.day);
    await say(g, 'jimu', ['{name}さん、おつかれさまです！', 'ファンの方から差し入れが届いてますよ。\nどうぞ！']);
    g.giveItem('grape_juice');
    return;
  }
  await say(g, 'jimu', pick([
    ['ファンレターの仕分け中です。', '所属タレントには、1日1回差し入れをお渡ししてるんですよ。'],
    ['ライブのチケット、今日も問い合わせがいっぱい！', 'ストアのグッズも、ライブの日はよく売れるんです。'],
    ['事務所のホワイトボード、見ました？', '今月のライブの予定がびっしりなんです。'],
  ]));
}

async function talkReception(g) {
  const st = g.state;
  if (!isMember(g)) {
    await say(g, 'reception', [
      'グレープカンパニー事務所へようこそ。',
      'オーディションは、右手前の審査テーブルで受けられます。\n合格すれば所属タレントです！',
      '演技に自信がなければ、右奥のドアの先の稽古場で\nレッスンを受けてみてくださいね。',
    ]);
  } else if (st.fame >= 2000) {
    await say(g, 'reception', ['{name}さん、おつかれさまです！', '最近、{name}さんあてのファンレターが\n山のように届いてますよ！']);
  } else {
    await say(g, 'reception', ['おつかれさまです、{name}さん！', 'お仕事の相談は右手のマネージャー紫藤へ。\n営業の房田さんも地方のお仕事を持っていますよ。']);
  }
}

async function talkWakate(g) {
  if (isMember(g)) {
    await say(g, 'wakate', pick([
      ['よっ、同期！', '事務所ライブはツッコミのタイミングが命だぞ。\nボケを最後まで聞いてから、ビシッと！'],
      ['テレビのプロデューサーさん、よく事務所に来るんだ。', '★250くらい知名度があれば、\nコント番組に呼んでもらえるらしいぜ。'],
      ['稽古場の「たてよこ」のコント、見た？', 'あいつら毎日稽古してるから、\n見学するだけでも勉強になるぞ。'],
    ]));
    return;
  }
  await say(g, 'wakate', [
    'オレもこの前オーディション受けて、ギリギリ合格したんだ。',
    'コント演技の審査は、表示される動きを\n落ち着いて正確に演じるのがコツだよ。',
    'ちなみに、オレのネタ帳はまだ真っ白だ！',
  ]);
}

async function scheduleBoard(g) {
  const lines = ['ホワイトボードに予定がびっしり書かれている。', '「月例コントライブ」「若手ネタ見せ会」\n「地方営業（各地）」「全国ツアー打ち合わせ」…'];
  if (isMember(g)) lines.push(g.flag('grape_solo_done') ? `すみっこに「祝！${g.state.name} 単独ライブ大成功」と書いてある。` : `すみっこに「${g.state.name}、ファイト！」と書いてある。うれしい！`);
  else lines.push('「新人オーディション 随時開催中！」\nという文字も見える。');
  await g.say(lines);
}

// ---------------------------------------------------------------- 稽古場
async function rehearsal(g) {
  const i = await ask(g, 'kakuta', ['おれたち、コンビ「たてよこ」です！', '新ネタのコント、見ていきます？'], ['見学する', 'やめておく']);
  if (i !== 0) { await say(g, 'kakuta', 'また見に来てくださいね！'); return; }
  await g.fadeOut();
  g.placePlayer(3, 7, 'up');
  g.placeNpc('maruo', 3, 3, 'down');
  g.placeNpc('kakuta', 5, 6, 'up');
  await g.fadeIn();
  await say(g, 'kakuta', 'コント「コンビニの新人」。\nよーい…はい！');
  g.sfx('snare');
  await g.moveNpc('kakuta', 'left left up', 1);
  await say(g, 'maruo', 'いらっしゃいませー！');
  await say(g, 'kakuta', 'これ、お願いします。');
  await say(g, 'maruo', 'ポイントカードはお持ちですか？');
  await say(g, 'kakuta', 'いえ、持ってないです。');
  await g.emote('maruo', '!');
  await say(g, 'maruo', 'では、お作りしますね！\nお名前と、好きな食べ物と、初恋の人の名前を…');
  g.sfx('hit');
  g.shake(10, 2);
  await g.emote('kakuta', '💢', 30);
  await say(g, 'kakuta', 'なんで初恋の人がいるんだよ！');
  await say(g, 'maruo', 'セキュリティの質問です！');
  await say(g, 'kakuta', 'ポイントカードに、そこまでいらないだろ！');
  await g.moveNpc('maruo', 'face:left wait face:down', 1);
  await say(g, 'maruo', 'では最後に、合言葉を決めてください。');
  await say(g, 'kakuta', 'もういいよ！');
  await g.moveNpc('kakuta', 'face:down');
  g.sfx('laugh');
  await Promise.all([g.emote('maruo', 'w'), g.emote('kakuta', 'w')]);
  await g.say('ふたり「どうも、ありがとうございました！」');
  g.sfx('applause');
  await g.emote('fujidana', '♪');
  await say(g, 'fujidana', 'うん、テンポはいい！\nツッコミは、もう半拍はやく入ってみよう。');
  if (!today(g, 'grape_watch_day')) {
    g.setFlag('grape_watch_day', g.state.day);
    g.addSkill('warai', 1, true);
    g.sfx('good');
    await g.say(`{name}はコントの「間（ま）」を学んだ！\nお笑いが1上がった。（${g.state.skills.warai}）`);
  } else {
    await g.say('ふたりのコントを楽しんだ！\n（見学で学べるのは1日1回までのようだ）');
  }
  await g.moveNpc('kakuta', 'down right right face:up', 1);
}

async function lessonMenu(g, who, def, adv) {
  const member = isMember(g);
  const price = member ? def.price - 1000 : def.price;
  const skill = g.state.skills[def.skill];
  const choices = skill >= 40 ? ['レッスン', '上級レッスン', 'やめておく'] : ['レッスン', 'やめておく'];
  const intro = def.intro.concat(member ? ['所属タレントは、レッスン料が¥1,000引きですよ。'] : []);
  const i = await ask(g, who, intro, choices);
  const after = member ? def.after : def.afterNew;
  if (choices[i] === 'レッスン') {
    const res = await g.lesson({ ...def, price, teacher: C[who].name });
    if (res) await say(g, who, after);
  } else if (choices[i] === '上級レッスン') {
    const res = await g.lesson({ ...def, ...adv, price: member ? adv.price - 1000 : adv.price, teacher: C[who].name });
    if (res) await say(g, who, after);
  } else {
    await say(g, who, 'またいつでもどうぞ。');
  }
}

const ENGI_LESSON = {
  title: 'コント演技レッスン', skill: 'engi', price: 3000, stamina: 12, gain: 4,
  minigame: 'conte', opts: { difficulty: 1, lesson: true, venue: V_KEIKO, partner: '藤棚先生', partnerLook: C.fujidana.look },
  intro: ['コント作家の藤棚です。', 'コントは「なりきる」ことが大事。\n動きのテンポを体にしみこませよう！'],
  after: 'いいね、役が生きてきた！\n次のコント番組、楽しみにしてるよ。',
  afterNew: 'いいね、役が生きてきた！\nその調子でオーディションも突破だ！',
};
const ENGI_ADV = { title: 'コント演技 上級', price: 7000, stamina: 15, gain: 6, opts: { difficulty: 3, lesson: true, venue: V_KEIKO, partner: '藤棚先生', partnerLook: C.fujidana.look } };
const WARAI_LESSON = {
  title: '漫才レッスン', skill: 'warai', price: 3000, stamina: 12, gain: 4,
  minigame: 'manzai', opts: { difficulty: 1, lines: LESSON_LINES, partner: '粒田先生', partnerLook: C.tsubuta.look, dialect: 'std', lesson: true, venue: V_KEIKO },
  intro: ['漫才講師の粒田です。', 'ツッコミは、ボケを最後まで聞いてから。\n早すぎても遅すぎてもダメですよ。'],
  after: 'うん、キレが出てきましたね。\n舞台でもその間合いを忘れずに！',
  afterNew: 'うん、キレが出てきましたね。\n事務所に入ったら、ライブで試してみましょう。',
};
const WARAI_ADV = { title: '漫才 上級', price: 7000, stamina: 15, gain: 6, opts: { difficulty: 3, lines: ADV_LINES, partner: '粒田先生', partnerLook: C.tsubuta.look, dialect: 'std', lesson: true, venue: V_KEIKO } };

async function talkKodougu(g) {
  if (!g.flag('grape_kodougu_gift')) {
    g.setFlag('grape_kodougu_gift');
    await say(g, 'kodougu', ['小道具の管理をしてます！', 'おもちゃのハンマーに、カツラに、つけヒゲ…\nコントは小道具で笑いが変わるんですよ。', 'あ、そうだ。余ってる台本、あげます！\n読んでおくと演技のヒントになりますよ。']);
    g.giveItem('daihon');
    return;
  }
  await say(g, 'kodougu', pick([
    ['このカツラ、何十回もコントに出てる\nベテランなんです。', '…カツラなのに、すっかり貫禄が出てきました。'],
    ['ツッコミ用のハンマーは、音が命！', 'いい音が鳴るやつだけを選んでるんです。'],
  ]));
}

async function talkMirror(g) {
  await say(g, 'mirror', pick([
    ['鏡の前で、ひとりコントの練習中！', 'ピン芸人は全部ひとりでやるから大変だけど、\nそのぶん自由なんだよ。'],
    ['表情の練習してるの。', '演技は顔から！…って、\n変顔見てたでしょ！？'],
  ]));
}

// ====================================================================== place
registerPlace({
  id: 'grape',
  name: 'グレープカンパニー',
  kind: 'building',
  bgm: 'office',
  start: { room: 'store', x: 8, y: 11, dir: 'up' },
  rooms: {
    // ------------------------------------------------------------ 1F オフィシャルストア
    store: {
      floor: 'grape_floor',
      wall: 'purple',
      bgm: 'grape_store',
      entry: { x: 16, y: 3, dir: 'down' },
      tiles: [
        '##################',
        '#UsUUsUUUUUUsUUsX#',
        '#=TTT=P====P=WWWX#',
        '#B..K............#',
        '#KRKK...........S#',
        '#...............S#',
        '#....DD....DD...S#',
        '#...............S#',
        '#.HHH........HHHS#',
        '#...............S#',
        '#....DD....DD....#',
        '#aF............Ga#',
        '########MM########',
      ],
      legend: {
        U: 'grape_wall_hi', s: 'grape_wall_hi+grape_spot', '=': 'grape_wall',
        T: 'grape_wall+grape_towel_wall', P: 'grape_wall+grape_poster', W: 'grape_wall+grape_wallshelf',
        X: 'grape_stairs_up', B: 'boxes', K: 'grape_counter', R: 'grape_register',
        S: 'grape_shelf', D: 'grape_table', H: 'grape_rack', F: 'fridge_drinks', G: 'grape_gacha', a: 'plant',
      },
      warps: [
        { x: 8, y: 12, to: 'exit' },
        { x: 9, y: 12, to: 'exit' },
        { x: 16, y: 2, room: 'office', tx: 16, ty: 11, dir: 'up' },
      ],
      entities: [
        { type: 'logo', x: 8, y: 1, w: 2, h: 2, logo: 'grape', talk: async (g) => { await g.showLogo('grape', 'グレープカンパニー公式ストア'); await g.say('紫色のロゴがまぶしい！\nここがグレープカンパニーのお店だ。'); } },
        npc('clerk', 2, 3, 'down', { talk: talkClerk }),
        npc('tencho', 8, 5, 'down', { talk: talkTencho }),
        npc('stairs', 14, 3, 'down', {
          text: ['奥の階段の上は、2階の事務所です。', 'オーディションや所属タレントのお仕事は、\n事務所の方へどうぞ！', '事務所の奥には稽古場もあって、\nレッスンも受けられますよ。'],
        }),
        npc('fan', 13, 6, 'left', {
          wander: 1,
          text: ['ここの芸人さんのコント、ほんとに面白いの！', 'ライブの前は、ここでタオルを買って\n首にかけて行くのがお約束なんだ〜。'],
        }),
        npc('student', 3, 9, 'up', {
          text: ['修学旅行の自由行動で来ました！', 'Tシャツ、どの色にしようかな…\nって、ほとんど紫だった！'],
        }),
        npc('kid', 13, 10, 'down', {
          wander: 1,
          text: ['カプセルトイ回したよ！', '金色のぶどうのバッジが出たら\n大当たりなんだって！'],
        }),
      ],
      events: [
        { x: 1, y: 10, w: 16, h: 1, on: 'step', once: 'grape_store_greet', run: greetStore },
        { x: 6, y: 2, on: 'action', run: (g) => g.say('「月例コントライブ」の告知ポスターだ。\n紫のチラシが目を引く。') },
        { x: 11, y: 2, on: 'action', run: (g) => g.say('「若手ネタ見せライブ」のポスターだ。\n未来のスターが出ているかも？') },
        { x: 13, y: 2, w: 3, h: 1, on: 'action', run: (g) => g.say('壁の棚に、マグカップやアクリルスタンド、\nライブのDVDが飾られている。') },
        { x: 5, y: 6, w: 2, h: 1, on: 'action', run: (g) => g.say('ロゴTシャツがたたんで積まれている。\nお買い上げはレジでどうぞ。') },
        { x: 11, y: 6, w: 2, h: 1, on: 'action', run: (g) => g.say('アクリルスタンドやステッカーが並んでいる。\nどれも紫色がテーマだ。') },
        { x: 5, y: 10, w: 2, h: 1, on: 'action', run: (g) => g.say('ネタ帳ふうのノートやペンが並んでいる。\n芸人気分が味わえそうだ。') },
        { x: 11, y: 10, w: 2, h: 1, on: 'action', run: (g) => g.say('マフラータオルがきれいに並んでいる。\nライブの必需品らしい。') },
        { x: 2, y: 8, w: 3, h: 1, on: 'action', run: (g) => g.say('紫や黒のTシャツ、パーカーがずらり。\nサイズもいろいろそろっている。') },
        { x: 13, y: 8, w: 3, h: 1, on: 'action', run: (g) => g.say('白いTシャツに紫のロゴ。\nシンプルでかっこいい！') },
        { x: 16, y: 4, w: 1, h: 6, on: 'action', run: (g) => g.say('グッズの棚だ。ライブDVDやキーホルダーが\nぎっしり並んでいる。') },
        { x: 15, y: 11, on: 'action', run: gacha },
      ],
    },

    // ------------------------------------------------------------ 2F 事務所
    office: {
      floor: 'grape_carpet',
      wall: 'purple',
      bgm: 'office',
      entry: { x: 16, y: 11, dir: 'up' },
      tiles: [
        '##################',
        '#UUUUUUUUUUcUUUUA#',
        '#=BB=P=w==w=P=d=w#',
        '#b....K....K.C.Ca#',
        '#.....KKKKKK.....#',
        '#...............v#',
        '#.DEE.......mn...#',
        '#................#',
        '#...............Z#',
        '#.SSS......JJJ...#',
        '#.ttt............#',
        '#a...............#',
        '################X#',
      ],
      legend: {
        U: 'grape_owall_hi', c: 'grape_owall_hi+clock', A: 'grape_owall_hi+grape_aircon', '=': 'grape_owall',
        B: 'grape_owall+whiteboard', w: 'grape_owall+window', P: 'grape_owall+grape_poster', d: 'door_wood',
        b: 'bookshelf', K: 'grape_counter', C: 'cabinet', a: 'plant', v: 'water_server',
        D: 'grape_desk_papers', E: 'grape_desk_pc', m: 'grape_desk_pc', n: 'grape_desk_papers',
        S: 'grape_sofa', t: 'table_low', J: 'grape_judge_table', X: 'grape_stairs_down', Z: 'grape_copier',
      },
      warps: [
        { x: 16, y: 12, room: 'store', tx: 16, ty: 3, dir: 'down' },
        { x: 14, y: 2, room: 'keiko', tx: 8, ty: 11, dir: 'up' },
      ],
      entities: [
        { type: 'logo', x: 8, y: 1, w: 2, h: 2, logo: 'grape' }, // behind the reception: decoration only
        {
          type: 'prop', x: 14, y: 1, w: 1, h: 1,
          draw(ctx, sx, sy) {
            ctx.fillStyle = PU_DD; ctx.fillRect(sx - 7, sy + 3, 30, 12);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 6, sy + 4, 28, 10);
            text(ctx, '稽古場', sx + 8, sy + 4, { size: 10, align: 'center', color: PU_DD, shadow: null });
          },
        },
        ...[[5, 4], [12, 4]].map(([x, y]) => ({
          type: 'prop', x, y, w: 1, h: 1, cond: (g) => !!g.flag('grape_solo_done'),
          text: '「祝・単独ライブ大成功」のお花だ。\nいい香りがする…！',
          draw(ctx, sx, sy) { ctx.drawImage(tileImage('flower_stand'), sx, sy); },
        })),
        {
          type: 'prop', x: 14, y: 9, w: 1, h: 1,
          text: '「新人オーディション 審査会場」と書いてある。\n審査テーブルの向こうにいる人に話しかけよう。',
          draw(ctx, sx, sy) {
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(sx + 2, sy + 14, 12, 2);
            ctx.fillStyle = '#8a5a33'; ctx.fillRect(sx + 3, sy + 2, 2, 13); ctx.fillRect(sx + 11, sy + 2, 2, 13); ctx.fillRect(sx + 7, sy + 8, 2, 7);
            ctx.fillStyle = PU_DD; ctx.fillRect(sx - 1, sy - 6, 18, 14);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy - 5, 16, 12);
            text(ctx, '審査', sx + 8, sy - 5, { size: 10, align: 'center', color: PU_D, shadow: null });
          },
        },
        npc('reception', 8, 3, 'down', { talk: talkReception }),
        npc('manager', 12, 5, 'down', { talk: talkManager }),
        npc('chief', 12, 8, 'down', { talk: talkChief }),
        npc('jimu', 2, 5, 'down', { talk: talkJimu }),
        npc('eigyo', 4, 5, 'down', { talk: talkEigyo }),
        npc('producer', 6, 10, 'left', { talk: talkProducer }),
        npc('wakate', 5, 9, 'left', { talk: talkWakate }),
      ],
      events: [
        { x: 2, y: 2, w: 2, h: 1, on: 'action', run: scheduleBoard },
        { x: 5, y: 2, on: 'action', run: (g) => g.say('所属芸人たちの単独ライブのポスターだ。\nいつか自分のポスターも…！') },
        { x: 12, y: 2, on: 'action', run: (g) => g.say('ライブツアーのポスターだ。\n全国の会場名がずらりと並んでいる。') },
        { x: 13, y: 3, on: 'action', run: (g) => g.say('キャビネットだ。ライブの台本や企画書が\nぎっしりつまっている。') },
        { x: 15, y: 3, on: 'action', run: (g) => g.say('キャビネットの上に、ライブのチラシの束が\n積まれている。') },
        { x: 2, y: 9, w: 3, h: 1, on: 'action', run: (g) => g.say('紫色のソファだ。ふかふかで、\nネタ合わせ前のひと休みにぴったり。') },
        { x: 2, y: 10, w: 3, h: 1, on: 'action', run: (g) => g.say('テーブルの上に、お茶とおせんべいが置いてある。') },
        { x: 16, y: 8, on: 'action', run: (g) => g.say('コピー機だ。ライブの台本が\nどんどん印刷されている。') },
      ],
      drawOver: drawCelebration,
    },

    // ------------------------------------------------------------ 稽古場
    keiko: {
      floor: 'floor_wood',
      wall: 'wood',
      bgm: 'studio',
      entry: { x: 8, y: 11, dir: 'up' },
      tiles: [
        '##################',
        '#YYOYYYUUMMMMMMMU#',
        '#yyoyyy=Bmmmmmmm=#',
        '#x....xs........L#',
        '#.kR............L#',
        '#...............r#',
        '#x....x.........r#',
        '#................#',
        '#...............Q#',
        '#nnn............Q#',
        '#...........q....#',
        '#a..............a#',
        '########EE########',
      ],
      legend: {
        Y: 'grape_set_hi', y: 'grape_set_lo', O: 'grape_set_door_hi', o: 'grape_set_door_lo',
        U: 'grape_kwall_hi', '=': 'grape_kwall', M: 'grape_kwall_hi+grape_mirror_hi', m: 'grape_kwall+grape_mirror_lo',
        B: 'grape_kwall+whiteboard', x: 'floor_wood+grape_tape', s: 'speaker', L: 'locker', r: 'clothes_rack',
        k: 'grape_set_counter', R: 'grape_set_register', Q: 'grape_propbox', n: 'grape_bench', q: 'grape_proptable', a: 'plant', E: 'grape_mat',
      },
      warps: [
        { x: 8, y: 12, room: 'office', tx: 14, ty: 3, dir: 'down' },
        { x: 9, y: 12, room: 'office', tx: 14, ty: 3, dir: 'down' },
      ],
      entities: [
        npc('maruo', 3, 3, 'down', { talk: rehearsal }),
        npc('kakuta', 5, 6, 'up', { talk: rehearsal }),
        npc('fujidana', 10, 4, 'down', { talk: (g) => lessonMenu(g, 'fujidana', ENGI_LESSON, ENGI_ADV) }),
        npc('tsubuta', 14, 4, 'down', { talk: (g) => lessonMenu(g, 'tsubuta', WARAI_LESSON, WARAI_ADV) }),
        npc('kodougu', 15, 9, 'right', { talk: talkKodougu }),
        npc('mirror', 12, 3, 'up', { talk: talkMirror, person: 'momo' }),
      ],
      events: [
        { x: 8, y: 2, on: 'action', run: (g) => g.say(['ホワイトボードに、ネタのメモが書いてある。', '「フリは丁寧に」「ツッコミは食い気味に」\n「最後まで役を生きる！」']) },
        { x: 1, y: 2, w: 6, h: 1, on: 'action', run: (g) => g.say('コント用のセットだ。\nコンビニの店内が、ベニヤ板に描かれている。') },
        { x: 9, y: 2, w: 7, h: 1, on: 'action', run: (g) => g.say('大きな鏡だ。\n自分の動きをチェックしながら稽古できる。') },
        { x: 16, y: 8, w: 1, h: 2, on: 'action', run: (g) => g.say('小道具の箱だ。おもちゃのハンマーやカツラが\nはみ出している。') },
        { x: 12, y: 10, on: 'action', run: (g) => g.say('小道具の台だ。帽子やカツラ、\n鼻メガネまで並んでいる。') },
        { x: 1, y: 9, w: 3, h: 1, on: 'action', run: (g) => g.say('長イスだ。ここで出番を待ちながら\nネタを確認するらしい。') },
        { x: 2, y: 4, w: 2, h: 1, on: 'action', run: (g) => g.say('コンビニのレジ…に見える、段ボール製の小道具だ。\nよく見ると、ボタンが手描きだ。') },
      ],
    },
  },
});
