// 東映 撮影所（東京エリア）
//
//   gate      撮影所ゲート・受付（守衛所・受付・売店・掲示板）
//   openset   時代劇オープンセット（江戸の町並み・殺陣リハーサルのカットシーン）
//   tokusatsu 特撮スタジオ（グリーンバック・石切り場セット・爆破テスト）
//   afureko   アフレコスタジオ（ブース・ミキサー卓・アニメのモニター）
//   costume   衣装部屋（着物・かつら・鎧・ヒーローのスーツ / 衣装を着て歩ける）
//
// 時代劇・特撮ヒーロー・アニメで知られる映画会社の撮影所をモチーフにした施設です。
// 登場人物・作品名はすべて架空のものです。

import { registerPlace } from '../engine/map.js';
import { defineTile, R, P, speckle, pix } from '../engine/tiles.js';
import { LOOKS, charSheet, drawChar } from '../engine/sprites.js';
import { registerItem } from '../engine/state.js';
import { registerSong } from '../engine/audio.js';
import { text } from '../engine/draw.js';
import { W, H, TILE, shade, pick, fmtMoney } from '../engine/util.js';

// =====================================================================
// looks
// =====================================================================
const LK = {
  guard: { ...LOOKS.guard },
  uketsuke: { ...LOOKS.receptionist, top: '#2f4f8a', bottom: '#20305a' },
  baiten: { ...LOOKS.mom, top: '#f2f2f2', bottom: '#5a6f8a' },
  veteran: { ...LOOKS.samurai, hairColor: 'silver', beard: true, top: '#4a3a5a', bottom: '#6a6a72' },
  tourist: { ...LOOKS.tourist },
  fan: { ...LOOKS.fan, hairColor: 'brown', top: '#ff9ac0' },
  staff: { ...LOOKS.staff, hat: '#2f9a4a', top: '#4a6a4a' },
  tateshi: { hair: 'short', hairColor: 'silver', skin: 'tan', top: '#2a2a30', bottom: '#2a2a30', beard: true },
  ronin: { ...LOOKS.samurai, top: '#6a6458', bottom: '#4a463e', beard: true },
  waka: { ...LOOKS.samurai, top: '#2f5fa8', bottom: '#d8d2c4' },
  ad: { ...LOOKS.ad, hair: 'cap', hat: '#2f6fd0' },
  kantoku: { ...LOOKS.director },
  musume: { hair: 'long', hairColor: 'black', skin: 'light', top: '#e86f8a', bottom: '#b84a62', skirt: true },
  chonin: { ...LOOKS.samurai, top: '#8a6a3a', bottom: '#6a5030', skirt: false },
  makeup: { ...LOOKS.makeup },
  action: { hair: 'spiky', hairColor: 'black', skin: 'tan', top: '#20232a', bottom: '#3b3f48' },
  hero: { ...LOOKS.hero },
  kaijin: { hair: 'spiky', hairColor: '#4a1f6a', skin: '#9a6abf', top: '#3a1f4a', bottom: '#3a1f4a', shoes: '#20232a', blush: false },
  pyro: { ...LOOKS.staff, hat: '#ff8a3d', top: '#ff8a3d', bottom: '#3b3f48' },
  producer: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#5a4a8a', bottom: '#2e3140', jacket: true, glasses: true },
  cameraman: { ...LOOKS.cameraman },
  kid: { ...LOOKS.kid, top: '#d62f2f' },
  onkan: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#3a3f4a', bottom: '#2a2d36', glasses: true, beard: true },
  mixer: { hair: 'cap', hat: '#20232a', hairColor: 'brown', skin: 'fair', top: '#5a6f8a', bottom: '#3b3f48' },
  seiyu: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#ff9a3c', bottom: '#2a3560', skirt: true },
  seiyu2: { hair: 'spiky', hairColor: 'black', skin: 'fair', top: '#2f9a4a', bottom: '#3b3f48' },
  manager: { ...LOOKS.manager },
  ishou: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#c25050', bottom: '#2a2430', skirt: true, glasses: true },
  katsura: { hair: 'bald', hairColor: 'white', skin: 'tan', top: '#f2f2f2', bottom: '#5a4a3a', glasses: true },
  ohariko: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#5fd7ff', bottom: '#3a4a7a', skirt: true },
};

const who = (npc) => ({ name: npc.name, look: npc.look });
const nm = (name, look) => ({ name, look });

// =====================================================================
// items & music
// =====================================================================
registerItem('toei_lokeben', { name: '撮影所のロケ弁', price: 600, desc: '撮影所の名物弁当。体力が45回復する。', heal: 45 });
registerItem('toei_dango', { name: 'みたらし団子', price: 250, desc: '茶屋の団子。甘じょっぱい！体力が20回復する。', heal: 20 });
registerItem('toei_ocha', { name: '茶屋のお茶', price: 120, desc: 'ほっとひと息。体力が10回復する。', heal: 10 });
registerItem('toei_sofubi', {
  name: 'ヒーローのソフビ', price: 800, desc: '光速ヒーロー ピクセリオンの人形。ながめるとワクワクする。',
  use: async (g) => { g.sfx('whistle'); await g.say('ピクセリオンのソフビ人形をかかげた！\n「変身！」…気分だけはヒーローだ。'); },
});
registerItem('toei_clapper', {
  name: 'サイン入りカチンコ', price: 0, desc: '劇場版のクランクアップ記念。スタッフ全員のサイン入り。',
  use: async (g) => { g.sfx('snare'); await g.say('カチン！\nあの撮影の日々を思い出す…。'); },
});

// 江戸の町（都節音階っぽい和風の曲）
registerSong('toei_edo', {
  bpm: 100, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'A4 . Bb4 . D5 - - . | E5 . F5 . E5 . D5 . | Bb4 . A4 . Bb4 . D5 . | A4 - - - . . . . | D5 . E5 . F5 - A5 . | F5 . E5 . D5 . Bb4 . | A4 . Bb4 . D5 . E5 . | D5 - - - . . . .' },
    { wave: 'square', vol: 0.018, notes: 'A3 . . A3 E4 . . . | A3 . . A3 D4 . . . | Bb3 . . Bb3 D4 . . . | A3 . . A3 E4 . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'A2 . . . . . . . | D2 . . . . . . . | Bb2 . . . . . . . | A2 . . . E2 . . .' },
    { wave: 'drum', vol: 0.09, notes: 'k . . . k . s . | k . . k . . s .' },
  ],
});

// 特撮ヒーローのテーマ（元気なマーチ）
registerSong('toei_hero', {
  bpm: 144, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.045, notes: 'E5 . E5 G5 A5 . G5 . | C6 - B5 . A5 . G5 . | F5 . F5 A5 G5 . E5 . | D5 - - . . . G4 . | E5 . E5 G5 A5 . G5 . | C6 - D6 . E6 - C6 . | B5 . A5 . G5 . B5 . | C6 - - - . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'C3 C3 G3 C3 C3 C3 G3 C3 | A2 A2 E3 A2 A2 A2 E3 A2 | F2 F2 C3 F2 F2 F2 C3 F2 | G2 G2 D3 G2 G2 G2 B2 G2 | C3 C3 G3 C3 C3 C3 G3 C3 | A2 A2 E3 A2 A2 A2 E3 A2 | F2 F2 C3 F2 G2 G2 D3 G2 | C3 C3 G3 C3 C3 . . .' },
    { wave: 'drum', vol: 0.1, notes: 'k . h k s . h . | k . h k s h s s' },
  ],
});

// =====================================================================
// tiles
// =====================================================================
function disc(c, cx, cy, rad, col) {
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad + rad * 0.6) P(c, cx + x, cy + y, col);
}
function oval(c, cx, cy, rx, ry, col) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.5) * (ry + 0.5)))));
    R(c, cx - w, cy + y, w * 2 + 1, 1, col);
  }
}
function shadowE(c, cx, cy, rx, ry) {
  c.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)));
    c.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

// ---------------------------------------------------------------- 撮影所の敷地
function studioWall(c) {
  R(c, 0, 0, 16, 16, '#d8d2c4');
  for (let x = 0; x < 16; x += 4) { R(c, x, 0, 1, 13, '#e9e4d8'); R(c, x + 2, 0, 1, 13, '#bdb6a6'); }
  R(c, 0, 0, 16, 1, '#f2eee4');
  R(c, 0, 13, 16, 3, '#7d7768'); R(c, 0, 13, 16, 1, '#5f594c');
}
defineTile('toei_studio_wall', { solid: true, draw: studioWall });
defineTile('toei_studio_top', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#4a4e5a'); R(c, 0, 0, 16, 1, '#5a5f6c'); R(c, 0, 15, 16, 1, '#8d939e'); },
});
defineTile('toei_lot', {
  variants: 4,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#a3a5aa');
    speckle(c, r, ['#989a9f', '#aeb0b5', '#93959a'], 26);
    if (v === 1) { R(c, 3, 9, 5, 1, '#8b8d92'); R(c, 7, 10, 4, 1, '#8b8d92'); P(c, 11, 11, '#8b8d92'); }
    if (v === 2) { R(c, 0, 0, 16, 1, '#b2b4b8'); }
  },
});
// 時代劇セットへの木戸（上：小さな瓦屋根、下：開いた門）
function kidoTop(c, side) {
  studioWall(c);
  const l = side === 'l';
  const x0 = l ? 2 : 0, x1 = l ? 16 : 14;
  R(c, x0 - (l ? 1 : 0), 3, x1 - x0 + 1, 1, '#7a849c');
  R(c, x0, 4, x1 - x0, 7, '#59627a');
  for (let x = x0 + 1; x < x1; x += 3) R(c, x, 4, 1, 7, '#3c4356');
  for (let x = x0; x < x1; x += 3) P(c, x, 10, '#9aa4bc');
  R(c, x0, 11, x1 - x0, 2, '#3a2416');
  R(c, l ? 3 : 10, 13, 3, 3, '#6e4428'); R(c, l ? 3 : 10, 13, 1, 3, '#8a5a33');
}
function kidoGate(c, r, side) {
  const l = side === 'l';
  R(c, 0, 0, 16, 16, '#a8d4f0');
  R(c, 0, 3, 16, 3, '#59627a'); R(c, 0, 3, 16, 1, '#7a849c');
  R(c, 0, 6, 16, 3, '#3a2416');
  for (let x = 1; x < 16; x += 3) R(c, x, 6, 1, 3, '#6e4428');
  R(c, 0, 9, 16, 7, '#c8a46c');
  speckle(c, r, ['#b9945c', '#d4b27a'], 10, 0, 9, 16, 7);
  if (l) {
    R(c, 0, 0, 3, 16, '#d8d2c4'); R(c, 0, 13, 3, 3, '#7d7768');
    R(c, 3, 0, 3, 16, '#6e4428'); R(c, 3, 0, 1, 16, '#8a5a33');
    R(c, 6, 0, 3, 15, '#9b6638'); for (let y = 2; y < 15; y += 4) R(c, 6, y, 3, 1, '#7a4f2a');
  } else {
    R(c, 13, 0, 3, 16, '#d8d2c4'); R(c, 13, 13, 3, 3, '#7d7768');
    R(c, 10, 0, 3, 16, '#6e4428'); R(c, 10, 0, 1, 16, '#8a5a33');
    R(c, 7, 0, 3, 15, '#9b6638'); for (let y = 2; y < 15; y += 4) R(c, 7, y, 3, 1, '#7a4f2a');
  }
}
defineTile('toei_kido_top_l', { solid: true, draw(c) { kidoTop(c, 'l'); } });
defineTile('toei_kido_top_r', { solid: true, draw(c) { kidoTop(c, 'r'); } });
defineTile('toei_kido_l', { draw(c, r) { kidoGate(c, r, 'l'); } });
defineTile('toei_kido_r', { draw(c, r) { kidoGate(c, r, 'r'); } });
defineTile('toei_door_wood', {
  draw(c) {
    studioWall(c);
    R(c, 2, 1, 12, 15, '#4a2f1c'); R(c, 3, 2, 10, 14, '#9b6638');
    R(c, 4, 3, 8, 5, '#a8733f'); R(c, 4, 9, 8, 6, '#a8733f'); R(c, 11, 8, 2, 2, '#ffd23f');
  },
});
defineTile('toei_door_stage', {
  draw(c) {
    studioWall(c);
    R(c, 0, 1, 16, 15, '#3b3f48'); R(c, 1, 3, 14, 13, '#7d8391');
    for (let y = 5; y < 16; y += 3) R(c, 1, y, 14, 1, '#6a7080');
    for (let x = 0; x < 16; x += 4) { R(c, x, 1, 2, 2, '#ffd23f'); R(c, x + 2, 1, 2, 2, '#20232a'); }
    R(c, 13, 9, 1, 3, '#20232a');
  },
});
defineTile('toei_door_snd', {
  draw(c) {
    studioWall(c);
    R(c, 2, 1, 12, 15, '#2a2d36'); R(c, 3, 2, 10, 14, '#6d7590');
    disc(c, 8, 6, 2, '#8fc8e8'); P(c, 7, 5, '#d8f0ff');
    R(c, 10, 9, 3, 1, '#c0c4cc'); R(c, 12, 9, 1, 3, '#c0c4cc');
  },
});
defineTile('toei_poster_jidai', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 1, 10, 12, '#20232a'); R(c, 4, 2, 8, 10, '#d8562a');
    disc(c, 9, 5, 2, '#ffd23f');
    R(c, 6, 4, 2, 2, '#20232a'); R(c, 5, 6, 4, 4, '#20232a'); R(c, 4, 10, 6, 1, '#20232a');
    for (let i = 0; i < 5; i++) P(c, 8 + i, 7 - i, '#f2f2f2');
    R(c, 10, 8, 1, 3, '#f2f2f2');
  },
});
defineTile('toei_poster_hero', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 1, 10, 12, '#20232a'); R(c, 4, 2, 8, 10, '#1f3f8a');
    R(c, 6, 3, 4, 4, '#d62f2f'); R(c, 6, 4, 4, 1, '#20232a'); P(c, 7, 4, '#5fd7ff');
    P(c, 6, 2, '#ffd23f'); P(c, 9, 2, '#ffd23f');
    R(c, 5, 7, 6, 4, '#d62f2f'); R(c, 5, 9, 6, 1, '#c0c4cc'); P(c, 8, 9, '#ffd23f');
    P(c, 4, 4, '#ffd23f'); P(c, 5, 5, '#ffd23f'); P(c, 11, 6, '#ffd23f'); P(c, 10, 7, '#ffd23f');
  },
});
defineTile('toei_poster_anime', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 1, 10, 12, '#20232a'); R(c, 4, 2, 8, 10, '#ffb0d0');
    R(c, 5, 3, 6, 3, '#ffd23f'); R(c, 4, 5, 2, 5, '#ffd23f'); R(c, 10, 5, 2, 5, '#ffd23f');
    R(c, 6, 5, 4, 4, '#ffe0c4');
    R(c, 6, 6, 1, 2, '#2f6fd0'); R(c, 9, 6, 1, 2, '#2f6fd0'); P(c, 7, 8, '#ff7eb6');
    R(c, 6, 9, 4, 3, '#5fd7ff'); P(c, 11, 3, '#ffffff'); P(c, 4, 11, '#ffffff');
  },
});
defineTile('toei_barrier_post', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 6, 15, 4, 1);
    R(c, 3, 6, 6, 9, '#f2f2f2'); R(c, 3, 6, 6, 1, '#ffffff'); R(c, 3, 14, 6, 1, '#9aa0aa');
    R(c, 4, 9, 4, 2, '#d62f2f');
    R(c, 9, 7, 7, 2, '#f2f2f2'); R(c, 11, 7, 2, 2, '#d62f2f'); R(c, 15, 7, 1, 2, '#d62f2f');
  },
});
defineTile('toei_barrier_arm', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 7, 16, 2, '#f2f2f2'); R(c, 3, 7, 3, 2, '#d62f2f'); R(c, 10, 7, 3, 2, '#d62f2f');
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 13, 16, 1);
  },
});
defineTile('toei_barrier_end', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 7, 10, 2, '#f2f2f2'); R(c, 2, 7, 3, 2, '#d62f2f');
    R(c, 9, 6, 1, 9, '#5a5f6b'); R(c, 11, 6, 1, 9, '#5a5f6b'); R(c, 8, 14, 5, 1, '#3b3f48');
  },
});

// ---------------------------------------------------------------- 江戸の町（オープンセット）
defineTile('toei_sky', {
  solid: true, variants: 4,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#8cc8f0'); R(c, 0, 0, 16, 5, '#7cbcea');
    if (v === 1) { R(c, 2, 5, 9, 2, '#ffffff'); R(c, 4, 4, 5, 1, '#ffffff'); R(c, 3, 7, 7, 1, '#e4f2fc'); }
    if (v === 3) { R(c, 7, 3, 7, 2, '#ffffff'); R(c, 9, 2, 3, 1, '#ffffff'); }
    for (let x = 0; x < 16; x++) { const h = 2 + ((x * 5 + v * 3) % 3); R(c, x, 16 - h, 1, h, '#9aa6c4'); }
  },
});
defineTile('toei_dirt', {
  variants: 4,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#c8a46c');
    speckle(c, r, ['#b9945c', '#d4b27a', '#bf9a62'], 22);
    if (v === 1) { P(c, 4, 5, '#8f7248'); P(c, 5, 5, '#a88a5a'); P(c, 11, 11, '#8f7248'); }
    if (v === 2) { R(c, 2, 9, 4, 1, '#b48e58'); R(c, 9, 3, 3, 1, '#b48e58'); }
  },
});
function kawara(c, base, hi, lo) {
  R(c, 0, 0, 16, 16, base);
  for (let x = 0; x < 16; x += 4) { R(c, x, 0, 1, 16, hi); R(c, x + 1, 0, 1, 16, shade(base, 0.1)); R(c, x + 3, 0, 1, 16, lo); }
  for (let y = 4; y < 16; y += 5) for (let x = 0; x < 16; x += 4) R(c, x, y, 4, 1, lo);
}
function itabuki(c, r) {
  R(c, 0, 0, 16, 16, '#7a5a3a');
  for (let y = 0; y < 16; y += 3) { R(c, 0, y, 16, 1, '#5e4228'); R(c, 0, y + 1, 16, 1, '#8c6a46'); }
  for (let y = 0; y < 16; y += 3) R(c, (y * 5) % 13, y + 1, 1, 2, '#5e4228');
  speckle(c, r, ['#6e4e30', '#86643f'], 10);
}
const ROOF = {
  gray: { base: '#59627a', hi: '#7a849c', lo: '#3c4356', ridge: '#2e3442' },
  wood: { ridge: '#4a3420' },
};
defineTile('toei_ridge', {
  solid: true,
  draw(c) { const k = ROOF.gray; kawara(c, k.base, k.hi, k.lo); R(c, 0, 0, 16, 6, k.ridge); R(c, 0, 1, 16, 1, '#4a5266'); R(c, 0, 6, 16, 1, '#20242e'); },
});
defineTile('toei_ridge2', {
  solid: true,
  draw(c, r) {
    itabuki(c, r); R(c, 0, 0, 16, 5, ROOF.wood.ridge); R(c, 0, 1, 16, 1, '#6a4c30'); R(c, 0, 5, 16, 1, '#2e1f12');
    disc(c, 4, 9, 1, '#9a968c'); disc(c, 12, 11, 1, '#8a867c'); P(c, 3, 8, '#b8b4aa'); P(c, 11, 10, '#b8b4aa');
  },
});
defineTile('toei_eave', {
  solid: true,
  draw(c) {
    const k = ROOF.gray; kawara(c, k.base, k.hi, k.lo);
    for (let x = 0; x < 16; x += 4) { R(c, x, 10, 3, 3, '#8a94ac'); P(c, x + 1, 11, '#3c4356'); }
    R(c, 0, 13, 16, 3, '#2a1c14'); R(c, 0, 13, 16, 1, '#4a3020');
  },
});
defineTile('toei_eave2', {
  solid: true,
  draw(c, r) {
    itabuki(c, r);
    disc(c, 6, 5, 1, '#9a968c'); P(c, 5, 4, '#b8b4aa');
    R(c, 0, 10, 16, 3, '#5e4228'); R(c, 0, 10, 16, 1, '#a07a50');
    R(c, 0, 13, 16, 3, '#2a1c14'); R(c, 0, 13, 16, 1, '#4a3020');
  },
});
function facadeBase(c) {
  R(c, 0, 0, 16, 2, '#1e140e');
  R(c, 0, 14, 16, 2, '#8a8478'); R(c, 0, 14, 16, 1, '#a8a294');
}
defineTile('toei_lattice', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#2a1a10');
    R(c, 0, 2, 16, 1, '#7a5030');
    for (let x = 0; x < 16; x += 3) { R(c, x, 3, 2, 10, '#8a5a33'); R(c, x, 3, 1, 10, '#a8743f'); }
    R(c, 0, 13, 16, 1, '#5a3a20');
    facadeBase(c);
  },
});
defineTile('toei_shoji', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#6e4428');
    R(c, 1, 3, 14, 7, '#f3ecd6');
    for (const x of [4, 8, 12]) R(c, x, 3, 1, 7, '#b89a6a');
    R(c, 1, 6, 14, 1, '#b89a6a');
    R(c, 0, 10, 16, 1, '#5a3a20');
    R(c, 1, 11, 14, 3, '#8a5a33'); R(c, 1, 11, 14, 1, '#a06c3c');
    facadeBase(c);
  },
});
function noren(c, cloth, crest) {
  R(c, 0, 0, 16, 16, '#1a110b');
  R(c, 0, 2, 16, 1, '#7a5030'); R(c, 0, 2, 1, 12, '#7a5030'); R(c, 15, 2, 1, 12, '#7a5030');
  R(c, 1, 3, 14, 8, cloth); R(c, 1, 3, 14, 1, shade(cloth, 0.25));
  pix(c, ['.www.', 'w...w', 'w...w', '.www.'], { w: crest }, 5, 5);
  R(c, 7, 6, 1, 5, shade(cloth, -0.4));
  R(c, 1, 10, 14, 1, shade(cloth, -0.3));
  R(c, 3, 11, 10, 3, '#3a2a1e');
  facadeBase(c);
  R(c, 0, 14, 16, 2, '#6a6458');
}
defineTile('toei_noren', { solid: true, draw(c) { noren(c, '#2a3f7a', '#f2f2f2'); } });
defineTile('toei_noren_red', { solid: true, draw(c) { noren(c, '#b83a3a', '#fff6e0'); } });
defineTile('toei_noren_brown', { solid: true, draw(c) { noren(c, '#6a4a2a', '#f2e2c0'); } });
function namako(c, y0) {
  R(c, 0, y0, 16, 16 - y0, '#2e3036');
  for (let y = y0 + 1; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 4 === 0 || (x - y + 32) % 4 === 0) P(c, x, y, '#cfcfcf');
  R(c, 0, y0, 16, 1, '#c9c4b5');
}
defineTile('toei_kura', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#ece7da'); R(c, 0, 0, 16, 2, '#1e140e'); R(c, 0, 2, 16, 1, '#d6d0c2');
    P(c, 3, 5, '#ddd6c6'); P(c, 11, 4, '#ddd6c6'); P(c, 7, 6, '#e2dccd');
    namako(c, 9);
  },
});
defineTile('toei_kura_door', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#ece7da'); R(c, 0, 0, 16, 2, '#1e140e');
    namako(c, 9);
    R(c, 2, 3, 12, 13, '#c9c4b5'); R(c, 3, 4, 10, 12, '#24221f'); R(c, 7, 4, 2, 12, '#3a3530');
    R(c, 3, 4, 10, 1, '#3a3530'); P(c, 5, 9, '#c9a227'); P(c, 10, 9, '#c9a227');
  },
});
defineTile('toei_chochin', {
  solid: true, obj: true, frames: 2, speed: 28,
  draw(c, r, f) {
    const body = f ? '#fff3c4' : '#f6e6a8';
    R(c, 7, 1, 2, 2, '#20232a');
    R(c, 5, 3, 6, 1, '#20232a');
    R(c, 4, 4, 8, 1, body); R(c, 3, 5, 10, 6, body); R(c, 4, 11, 8, 1, body);
    for (let y = 5; y < 11; y += 2) R(c, 3, y, 10, 1, shade(body, -0.08));
    R(c, 3, 7, 10, 2, '#c8323f');
    R(c, 5, 12, 6, 1, '#20232a');
    R(c, 7, 13, 2, 2, '#c8323f');
    if (f) { P(c, 2, 7, '#ffe48a'); P(c, 13, 7, '#ffe48a'); P(c, 8, 3, '#ffe48a'); }
  },
});
defineTile('toei_andon', {
  solid: true, obj: true, frames: 2, speed: 34,
  draw(c, r, f) {
    shadowE(c, 8, 15, 5, 1);
    R(c, 7, 0, 2, 2, '#3a2416'); R(c, 4, 2, 8, 1, '#3a2416');
    R(c, 4, 3, 8, 9, '#3a2416');
    R(c, 5, 4, 6, 7, f ? '#fff4c8' : '#ffe9a8');
    R(c, 6, 5, 4, 5, f ? '#ffe070' : '#ffd860');
    R(c, 8, 4, 1, 7, '#c8a050');
    R(c, 4, 12, 8, 1, '#3a2416'); R(c, 4, 13, 1, 2, '#3a2416'); R(c, 11, 13, 1, 2, '#3a2416');
  },
});
defineTile('toei_well', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 14, 7, 2);
    oval(c, 8, 11, 7, 3, '#6e695e');
    oval(c, 8, 10, 7, 3, '#a29c8e');
    oval(c, 8, 10, 5, 2, '#1e2a3a');
    P(c, 6, 10, '#4a6a8a'); P(c, 3, 9, '#bdb8aa'); P(c, 12, 9, '#bdb8aa');
    R(c, 1, 3, 2, 8, '#6e4428'); R(c, 13, 3, 2, 8, '#6e4428');
    R(c, 0, 2, 16, 2, '#5a3a20'); R(c, 0, 2, 16, 1, '#7a5030');
    disc(c, 8, 4, 1, '#3b3f48');
    R(c, 8, 5, 1, 3, '#d8c89a');
    R(c, 7, 7, 3, 2, '#8a5a33'); R(c, 7, 7, 3, 1, '#a8743f');
  },
});
function komodaru(c, x, y, w, h) {
  R(c, x, y, w, h, '#e8dcb8'); R(c, x, y, w, 1, '#f6eed6'); R(c, x, y + h - 1, w, 1, '#c8b890');
  R(c, x, y + 1, w, 1, '#8a6a3a'); R(c, x, y + h - 2, w, 1, '#8a6a3a');
  R(c, x + 2, y + 2, w - 4, h - 4, '#c8323f');
  R(c, x + Math.floor(w / 2), y + 3, 1, h - 6, '#f2f2f2');
}
defineTile('toei_taru', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 15, 7, 1);
    komodaru(c, 1, 8, 7, 7); komodaru(c, 8, 8, 7, 7); komodaru(c, 4, 1, 8, 7);
  },
});
defineTile('toei_yanagi', {
  solid: true, obj: true,
  draw(c, r) {
    shadowE(c, 8, 14, 6, 2);
    R(c, 7, 6, 2, 9, '#5a3a20'); R(c, 7, 6, 1, 9, '#7a5030');
    disc(c, 8, 4, 5, '#4f7f32'); disc(c, 8, 3, 4, '#6a9f40');
    for (const [x, len] of [[2, 8], [4, 10], [6, 7], [10, 9], [12, 10], [14, 7]]) { R(c, x, 4, 1, len, '#7ab44a'); P(c, x, 4 + len, '#5a8a38'); }
    speckle(c, r, ['#8cc85a'], 6, 4, 1, 9, 5);
  },
});
defineTile('toei_fence', {
  solid: true, obj: true,
  draw(c) {
    for (let x = 0; x < 16; x += 3) {
      R(c, x, 2, 2, 13, '#b4ad5c'); R(c, x, 2, 1, 13, '#d4cc7c'); R(c, x, 1, 2, 1, '#8a8440');
      R(c, x, 6, 2, 1, '#8a8440'); R(c, x, 11, 2, 1, '#8a8440');
    }
    R(c, 0, 4, 16, 1, '#4a3a20'); R(c, 0, 10, 16, 1, '#4a3a20');
  },
});
defineTile('toei_kosatsu', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 15, 6, 1);
    R(c, 3, 9, 2, 7, '#5a3a20'); R(c, 11, 9, 2, 7, '#5a3a20');
    R(c, 0, 1, 16, 2, '#3c4356'); R(c, 1, 0, 14, 1, '#59627a');
    R(c, 1, 3, 14, 7, '#7a5030'); R(c, 2, 4, 12, 5, '#efe2bf');
    for (const [x, h] of [[3, 4], [5, 3], [7, 4], [9, 2], [11, 4], [12, 3]]) R(c, x, 4 + (x % 2), 1, h, '#20232a');
  },
});
defineTile('toei_tensui', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 15, 6, 1);
    R(c, 2, 8, 12, 7, '#6e4428'); R(c, 2, 8, 12, 1, '#8a5a33');
    R(c, 2, 10, 12, 1, '#3a2416'); R(c, 2, 13, 12, 1, '#3a2416');
    const bucket = (x, y) => { R(c, x, y, 5, 4, '#a83232'); R(c, x, y, 5, 1, '#c84a4a'); P(c, x + 2, y + 2, '#f2f2f2'); };
    bucket(3, 4); bucket(8, 4); bucket(5, 0);
  },
});
defineTile('toei_engi', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 14, 8, 1);
    R(c, 1, 10, 2, 5, '#4a2f1c'); R(c, 13, 10, 2, 5, '#4a2f1c');
    R(c, 0, 9, 16, 2, '#6e4428');
    R(c, 0, 4, 16, 6, '#c8323f'); R(c, 0, 4, 16, 1, '#e8586a'); R(c, 0, 9, 16, 1, '#9a1f2c');
  },
});
defineTile('toei_engi_tea', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 14, 8, 1);
    R(c, 1, 10, 2, 5, '#4a2f1c'); R(c, 13, 10, 2, 5, '#4a2f1c');
    R(c, 0, 9, 16, 2, '#6e4428');
    R(c, 0, 4, 16, 6, '#c8323f'); R(c, 0, 4, 16, 1, '#e8586a'); R(c, 0, 9, 16, 1, '#9a1f2c');
    R(c, 9, 4, 4, 3, '#efe8d8'); R(c, 9, 4, 4, 1, '#5a8a38');
    R(c, 2, 6, 6, 1, '#d8b878'); P(c, 3, 5, '#a8602a'); P(c, 5, 5, '#a8602a'); P(c, 7, 5, '#a8602a');
  },
});
function hori(c, r, f) {
  R(c, 0, 0, 16, 16, '#2f5f86');
  speckle(c, r, ['#2a5679', '#386a94'], 10);
  const o = f * 5;
  for (const [x, y] of [[2, 4], [10, 9], [5, 13]]) R(c, (x + o) % 16, y, 4, 1, '#6f9fd4');
}
defineTile('toei_hori_top', {
  solid: true, frames: 2, speed: 45,
  draw(c, r, f) {
    hori(c, r, f);
    R(c, 0, 0, 16, 7, '#8e8a80');
    R(c, 0, 0, 16, 1, '#b8b4aa'); R(c, 0, 3, 16, 1, '#6e6a60'); R(c, 0, 6, 16, 1, '#5a564e');
    for (const x of [3, 10]) R(c, x, 1, 1, 2, '#6e6a60');
    for (const x of [6, 13]) R(c, x, 4, 1, 2, '#6e6a60');
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 7, 16, 2);
  },
});
defineTile('toei_hori', {
  solid: true, frames: 2, speed: 45,
  draw(c, r, f) { hori(c, r, f); R(c, 0, 14, 16, 2, '#8e8a80'); R(c, 0, 14, 16, 1, '#b8b4aa'); },
});
function hashi(c, side) {
  R(c, 0, 0, 16, 16, '#b07a46');
  for (let y = 0; y < 16; y += 3) { R(c, 0, y, 16, 1, '#8a5a30'); R(c, 0, y + 1, 16, 1, '#c08a52'); }
  const rx = side === 'l' ? 0 : 13;
  R(c, rx, 0, 3, 16, '#a8202c'); R(c, rx + 1, 0, 1, 16, '#d03a44');
  R(c, rx, 6, 3, 3, '#c9a227'); P(c, rx + 1, 6, '#fff6a8');
}
defineTile('toei_hashi_l', { draw(c) { hashi(c, 'l'); } });
defineTile('toei_hashi_r', { draw(c) { hashi(c, 'r'); } });
defineTile('toei_katana', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 14, 7, 1);
    R(c, 1, 3, 2, 11, '#3a2416'); R(c, 13, 3, 2, 11, '#3a2416'); R(c, 0, 13, 16, 2, '#3a2416');
    for (const y of [4, 7, 10]) {
      R(c, 0, y, 11, 2, '#1e1e26'); R(c, 0, y, 11, 1, '#3a3a46');
      R(c, 10, y - 1, 1, 4, '#c9a227');
      R(c, 11, y, 5, 2, '#e8e2d0'); P(c, 12, y, '#20232a'); P(c, 14, y + 1, '#20232a');
    }
  },
});

// ---------------------------------------------------------------- 特撮スタジオ
defineTile('toei_gravel', {
  variants: 3,
  draw(c, r) { R(c, 0, 0, 16, 16, '#b8ad98'); speckle(c, r, ['#a59a84', '#c9bfaa', '#968b76', '#d4cab6'], 40); },
});
defineTile('toei_studio_floor', {
  variants: 14,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#2e3038'); speckle(c, r, ['#34363f', '#292b32'], 14);
    // バミリ（立ち位置の目印テープ）
    if (v === 1) { R(c, 4, 9, 4, 1, '#c8a83a'); R(c, 4, 9, 1, 3, '#c8a83a'); }
    if (v === 2) { R(c, 9, 4, 3, 1, '#b8bcc8'); R(c, 11, 4, 1, 3, '#b8bcc8'); }
  },
});
defineTile('toei_green_floor', {
  draw(c, r) { R(c, 0, 0, 16, 16, '#2fae4e'); speckle(c, r, ['#2aa047', '#34b855'], 8); },
});
defineTile('toei_rock', {
  solid: true, obj: true, variants: 2,
  draw(c, r, f, v) {
    shadowE(c, 8, 14, 7, 2);
    oval(c, 8, 9, 7, 5, '#6a5e4e');
    oval(c, 8, 8, 6, 5, '#8a7c66');
    oval(c, 6, 6, 3, 2, '#a8987e');
    R(c, 9, 7, 1, 4, '#5a4e40'); P(c, 10, 10, '#5a4e40'); P(c, 5, 10, '#6a5e4e');
    if (v) { oval(c, 13, 12, 2, 2, '#7a6e5a'); P(c, 12, 11, '#a8987e'); }
  },
});
defineTile('toei_bd_sky', {
  solid: true, variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#7cc0ec'); R(c, 0, 9, 16, 7, '#9ad0f2');
    if (v === 0) { R(c, 2, 4, 9, 2, '#ffffff'); R(c, 4, 3, 5, 1, '#ffffff'); }
    if (v === 2) { R(c, 8, 6, 6, 2, '#ffffff'); R(c, 9, 5, 3, 1, '#ffffff'); }
    for (let x = 0; x < 16; x++) { const h = 3 + ((x * 5 + v * 7) % 4); R(c, x, 16 - h, 1, h, '#8a94b8'); }
    R(c, 0, 0, 16, 1, '#5d6270');
  },
});
defineTile('toei_bd_cliff', {
  solid: true, variants: 2,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#a08a6a');
    R(c, 0, 3, 16, 2, '#8a7454'); R(c, 0, 8, 16, 1, '#b8a280'); R(c, 0, 11, 16, 2, '#7a6448');
    R(c, 5 + v * 4, 0, 1, 6, '#6a5438'); R(c, 11 - v * 6, 6, 1, 5, '#6a5438');
    for (let x = 0; x < 16; x++) { const h = (x * 7 + v * 3) % 3; if (h) R(c, x, 0, 1, h, '#9ad0f2'); }
    R(c, 0, 13, 16, 3, '#5a4632'); R(c, 0, 13, 16, 1, '#3a2c1e');
  },
});
defineTile('toei_pyro', {
  solid: true, obj: true, frames: 2, speed: 30,
  draw(c, r, f) {
    shadowE(c, 8, 14, 6, 1);
    R(c, 3, 7, 10, 7, '#2a2d36'); R(c, 3, 7, 10, 1, '#4a4e58');
    for (let x = 3; x < 13; x += 2) R(c, x, 12, 1, 2, '#ffd23f');
    R(c, 6, 3, 4, 4, '#3b3f48'); R(c, 6, 3, 4, 1, '#5a5f6b'); R(c, 7, 2, 2, 1, '#20232a');
    P(c, 11, 9, f ? '#ff2b3a' : '#7a1f1f');
    R(c, 13, 11, 3, 1, '#d62f2f');
  },
});
defineTile('toei_camera_up', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 14, 6, 2);
    R(c, 7, 9, 2, 5, '#3b3f48');
    for (let i = 0; i < 4; i++) { P(c, 6 - i, 10 + i, '#3b3f48'); P(c, 9 + i, 10 + i, '#3b3f48'); }
    R(c, 4, 3, 8, 7, '#20232a'); R(c, 5, 4, 6, 5, '#3b3f48');
    R(c, 5, 0, 6, 3, '#20232a'); R(c, 6, 0, 4, 2, '#4a4e58'); P(c, 7, 0, '#5fd7ff');
    R(c, 11, 5, 3, 3, '#20232a'); P(c, 12, 6, '#5fd7ff');
    P(c, 5, 4, '#ff2b3a');
  },
});
function suit(c, col, dark, visor, horns) {
  shadowE(c, 8, 15, 4, 1);
  R(c, 5, 14, 6, 1, '#3b3f48'); R(c, 7, 11, 2, 3, '#5a5f6b');
  R(c, 5, 6, 6, 6, col); R(c, 4, 6, 1, 5, col); R(c, 11, 6, 1, 5, col);
  R(c, 4, 10, 1, 1, '#f2f2f2'); R(c, 11, 10, 1, 1, '#f2f2f2');
  R(c, 7, 6, 2, 2, horns ? '#ffd23f' : '#f2f2f2');
  R(c, 5, 9, 6, 1, '#c0c4cc'); P(c, 8, 9, '#ffd23f');
  R(c, 6, 11, 4, 1, dark);
  R(c, 5, 1, 6, 5, col); R(c, 6, 0, 4, 1, col);
  R(c, 5, 3, 6, 1, visor); R(c, 6, 4, 4, 1, visor);
  R(c, 7, 5, 2, 1, '#c0c4cc');
  if (horns) { P(c, 4, 0, '#ffd23f'); P(c, 5, 1, '#ffd23f'); P(c, 11, 0, '#ffd23f'); P(c, 10, 1, '#ffd23f'); }
  else { P(c, 6, 0, '#ffd23f'); P(c, 9, 0, '#ffd23f'); }
}
defineTile('toei_suit_red', { solid: true, obj: true, draw(c) { suit(c, '#d62f2f', '#9a1f22', '#20232a', false); } });
defineTile('toei_suit_blue', { solid: true, obj: true, draw(c) { suit(c, '#2f6fd0', '#1f4a90', '#20232a', false); } });
defineTile('toei_suit_villain', { solid: true, obj: true, draw(c) { suit(c, '#6a3a8a', '#3a1f4a', '#ffd23f', true); } });

// ---------------------------------------------------------------- アフレコスタジオ
defineTile('toei_sound_wall', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#4a5068'); R(c, 0, 0, 16, 1, '#6a7090');
    for (let y = 2; y < 13; y += 4) for (let x = (y % 8 === 2 ? 2 : 0); x < 16; x += 4) { P(c, x, y, '#353a4e'); P(c, x + 1, y + 1, '#5d6484'); }
    R(c, 0, 13, 16, 3, '#2a2e3e'); R(c, 0, 13, 16, 1, '#20232a');
  },
});
defineTile('toei_glass', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#4a5068');
    R(c, 0, 0, 16, 10, '#20232a');
    R(c, 1, 1, 14, 8, '#8fc8e8'); R(c, 1, 1, 14, 1, '#b8e0f4');
    for (let i = 0; i < 4; i++) { P(c, 3 + i, 7 - i, '#d8f0ff'); P(c, 4 + i, 7 - i, '#d8f0ff'); P(c, 10 + i, 7 - i, '#c8e8f8'); }
    R(c, 0, 10, 16, 1, '#6a7090');
    for (const x of [3, 7, 11]) P(c, x, 13, '#353a4e');
    R(c, 0, 15, 16, 1, '#2a2e3e');
  },
});
defineTile('toei_booth_door', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#4a5068');
    R(c, 2, 0, 12, 16, '#20232a'); R(c, 3, 1, 10, 15, '#6d7590');
    disc(c, 8, 5, 2, '#8fc8e8'); P(c, 7, 4, '#d8f0ff');
    R(c, 10, 8, 2, 3, '#c0c4cc');
  },
});
defineTile('toei_console', {
  solid: true, obj: true, frames: 2, speed: 18,
  draw(c, r, f) {
    shadowE(c, 8, 15, 8, 1);
    R(c, 0, 3, 16, 10, '#2e3038'); R(c, 0, 3, 16, 1, '#6a7080'); R(c, 0, 13, 16, 2, '#1a1c22');
    for (let x = 1; x < 16; x += 3) { R(c, x, 6, 1, 6, '#14151a'); R(c, x - 1 + 1, 6 + ((x * 7 + f * 3) % 5), 2, 1, '#f2f2f2'); }
    for (let x = 2; x < 16; x += 3) P(c, x, 4, (x + f) % 3 === 0 ? '#ff5d6c' : (x + f) % 3 === 1 ? '#ffd23f' : '#5ee07a');
  },
});
defineTile('toei_rec', {
  solid: true, obj: true, frames: 2, speed: 40,
  draw(c, r, f) {
    R(c, 1, 4, 14, 8, '#20232a'); R(c, 2, 5, 12, 6, f ? '#ff2b3a' : '#6a1a1a');
    if (f) {
      pix(c, [
        'RR.EEE.CCC',
        'R.RE...C..',
        'RR.EE..C..',
        'R.RE...C..',
        'R.REEE.CCC',
      ], { R: '#ffffff', E: '#ffffff', C: '#ffffff' }, 3, 5);
    }
  },
});

// ---------------------------------------------------------------- 衣装部屋
defineTile('toei_kimono_rack', {
  solid: true, obj: true, variants: 3,
  draw(c, r, f, v) {
    shadowE(c, 8, 15, 7, 1);
    R(c, 0, 1, 16, 1, '#6e4428'); R(c, 0, 1, 1, 14, '#6e4428'); R(c, 15, 1, 1, 14, '#6e4428');
    R(c, 0, 14, 3, 1, '#4a2f1c'); R(c, 13, 14, 3, 1, '#4a2f1c');
    const [col, dot] = [['#2a3f7a', '#f2f2f2'], ['#c8323f', '#ffd3e3'], ['#2f6b34', '#ffd23f']][v];
    R(c, 1, 2, 14, 5, col); R(c, 4, 2, 8, 11, col);
    R(c, 1, 6, 3, 1, shade(col, -0.3)); R(c, 12, 6, 3, 1, shade(col, -0.3));
    R(c, 6, 2, 1, 4, '#f2ead2'); R(c, 9, 2, 1, 4, '#f2ead2'); R(c, 7, 5, 2, 1, '#f2ead2');
    R(c, 4, 8, 8, 2, '#c9a227'); R(c, 4, 8, 8, 1, '#e8c84a');
    for (const [x, y] of [[2, 3], [13, 4], [5, 11], [10, 12], [6, 4], [11, 3]]) P(c, x, y, dot);
  },
});
defineTile('toei_wig', {
  solid: true, obj: true, variants: 2,
  draw(c, r, f, v) {
    shadowE(c, 8, 15, 4, 1);
    R(c, 3, 13, 10, 2, '#6e4428'); R(c, 3, 13, 10, 1, '#8a5a33'); R(c, 7, 10, 2, 3, '#8a5a33');
    oval(c, 8, 7, 4, 3, '#e8d8c0');
    if (v === 0) {
      R(c, 4, 4, 2, 5, '#20232a'); R(c, 10, 4, 2, 5, '#20232a'); R(c, 4, 3, 8, 2, '#20232a');
      R(c, 6, 4, 4, 2, '#c8c0b8');
      R(c, 7, 1, 2, 3, '#20232a'); R(c, 6, 1, 4, 1, '#20232a');
    } else {
      oval(c, 8, 3, 5, 2, '#20232a'); R(c, 3, 4, 10, 4, '#20232a'); R(c, 5, 0, 6, 2, '#20232a');
      P(c, 12, 2, '#c8323f'); P(c, 13, 1, '#ffd23f'); P(c, 3, 2, '#ffd23f');
    }
  },
});
defineTile('toei_yoroi', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 15, 6, 1);
    R(c, 3, 13, 10, 2, '#3a2416'); R(c, 3, 13, 10, 1, '#5a3a20');
    R(c, 4, 6, 8, 7, '#1e1e26');
    for (let y = 7; y < 13; y += 2) R(c, 4, y, 8, 1, '#c8323f');
    R(c, 2, 6, 2, 5, '#1e1e26'); R(c, 12, 6, 2, 5, '#1e1e26');
    P(c, 2, 8, '#c8323f'); P(c, 13, 8, '#c8323f');
    R(c, 5, 2, 6, 3, '#20232a'); R(c, 4, 4, 8, 2, '#2e3038');
    R(c, 6, 4, 4, 2, '#8a1f22');
    P(c, 4, 0, '#ffd23f'); P(c, 5, 1, '#ffd23f'); P(c, 11, 0, '#ffd23f'); P(c, 10, 1, '#ffd23f'); R(c, 7, 1, 2, 2, '#ffd23f');
  },
});
defineTile('toei_helmet_shelf', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#6e7380'); R(c, 1, 1, 14, 14, '#3b3f48');
    R(c, 1, 7, 14, 1, '#8d939e'); R(c, 1, 14, 14, 1, '#8d939e');
    const helm = (x, y, col) => { R(c, x, y, 4, 4, col); R(c, x, y + 1, 4, 1, '#20232a'); R(c, x + 1, y + 2, 2, 1, '#20232a'); P(c, x, y, shade(col, 0.3)); };
    helm(2, 3, '#d62f2f'); helm(7, 3, '#2f6fd0'); helm(11, 3, '#ffd23f');
    helm(4, 10, '#2f9a4a'); helm(9, 10, '#ff7eb6');
  },
});
defineTile('toei_sewing', {
  solid: true, obj: true,
  draw(c) {
    shadowE(c, 8, 14, 7, 1);
    R(c, 0, 6, 16, 5, '#b98552'); R(c, 0, 6, 16, 1, '#d6a06a'); R(c, 0, 11, 16, 2, '#8a5a33');
    R(c, 1, 13, 2, 2, '#5a3a20'); R(c, 13, 13, 2, 2, '#5a3a20');
    R(c, 3, 2, 9, 3, '#f2f2f2'); R(c, 10, 2, 2, 6, '#e0e0e0'); R(c, 3, 2, 2, 5, '#e0e0e0'); R(c, 3, 2, 9, 1, '#ffffff');
    P(c, 4, 7, '#9aa0aa');
    R(c, 5, 8, 8, 2, '#ff7eb6'); R(c, 5, 8, 8, 1, '#ffa0c8');
  },
});
defineTile('toei_byobu', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 15, '#3a2416');
    R(c, 1, 1, 7, 13, '#d8b440'); R(c, 8, 1, 7, 13, '#e8c858');
    R(c, 2, 3, 5, 1, '#f6e6a8'); R(c, 9, 8, 5, 1, '#f6e6a8');
    R(c, 3, 8, 4, 2, '#2f6b34'); R(c, 4, 7, 2, 1, '#2f6b34'); R(c, 10, 4, 4, 2, '#2f6b34'); R(c, 11, 6, 1, 4, '#5a3a20');
  },
});

// =====================================================================
// small helpers: positions, sprites, effects
// =====================================================================
function setPos(e, x, y, dir) {
  if (!e) return;
  Object.assign(e, { x, y, px: x * TILE, py: y * TILE, moving: false, t: 0, path: [] });
  if (dir) e.dir = dir;
}
function homePos(e) { if (e) setPos(e, e.def.x, e.def.y, e.def.dir || 'down'); }
const frameOf = (e) => (e.moving ? [1, 0, 2, 0][Math.floor(e.anim / 8) % 4] : 0);

// A samurai holding a (bamboo) katana: used while the rehearsal plays.
function swordSprite(look) {
  const sheet = charSheet(look);
  const BL = '#eef2f8', BS = '#8e98ac', TB = '#c9a227', HD = '#2a1a10';
  return (ctx, x, y, g, e) => {
    const X = Math.round(x), Y = Math.round(y), d = e.dir;
    const sword = () => {
      if (d === 'left' || d === 'right') {
        const s = d === 'right' ? 1 : -1, ox = d === 'right' ? 11 : 4;
        F(ctx, ox === 11 ? X + 11 : X + 2, Y + 10, 3, 1, HD);
        F(ctx, X + ox + s * 3, Y + 8, 1, 4, TB);
        for (let i = 0; i < 10; i++) {
          const bx = X + ox + s * (4 + i), by = Y + 9 - Math.floor(i / 3);
          F(ctx, bx, by, 1, 1, BL); F(ctx, bx, by + 1, 1, 1, BS);
        }
      } else if (d === 'down') {
        F(ctx, X + 12, Y + 8, 1, 3, HD); F(ctx, X + 11, Y + 11, 3, 1, TB);
        for (let i = 0; i < 8; i++) F(ctx, X + 12 + Math.floor(i / 4), Y + 12 + i, 1, 1, i % 2 ? BS : BL);
      } else {
        F(ctx, X + 3, Y - 7, 1, 12, BL); F(ctx, X + 4, Y - 6, 1, 11, BS); F(ctx, X + 2, Y + 5, 4, 1, TB);
      }
    };
    if (d === 'up') sword();
    drawChar(ctx, sheet, d, frameOf(e), x, y);
    if (d !== 'up') sword();
  };
}

// The fallen samurai: the standing sprite rotated 90° (head to the left).
function lyingSprite(look) {
  const sheet = charSheet(look);
  return (ctx, x, y) => {
    ctx.save();
    ctx.translate(Math.round(x) + 8, Math.round(y) + 9);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(sheet.down[0], -8, -10);
    ctx.restore();
  };
}

// Costumes the player can wear inside the studio lot.
const COSTUMES = {
  samurai: { label: 'お侍さん', look: (b) => ({ ...b, hair: 'mage', top: '#3a4a7a', bottom: '#5a5f6b', skirt: true, jacket: false, tie: null, glasses: false }), line: 'まあ、りりしいお侍さん！\n刀を差したら、もう時代劇の主役ね！' },
  musume: { label: '町娘', look: (b) => ({ ...b, hair: 'long', top: '#e86f8a', bottom: '#b84a62', skirt: true, jacket: false, tie: null, glasses: false }), line: 'かわいい町娘さんの完成！\nかんざしもよく似合ってるわよ。' },
  ninja: { label: '忍者', look: () => ({ ...LOOKS.ninja }), line: 'ドロン！…なんてね。\nどこから見ても立派な忍者よ！' },
  hero: { label: 'ヒーロー', look: () => ({ ...LOOKS.hero }), line: 'ヒーロースーツ、着心地はどう？\n中は暑いから気をつけてね！' },
};
function wearCostume(g, key) {
  const p = g.map.player;
  const look = COSTUMES[key].look({ ...(g.state.look || {}) });
  const sheet = charSheet(look);
  p.toeiCostume = key;
  p.sprite = (ctx, x, y, gg, e) => {
    if (!gg.map || gg.map.placeId !== 'toei') {
      e.sprite = null; e.toeiCostume = null;
      drawChar(ctx, charSheet(gg.state.look || {}), e.dir, frameOf(e), x, y);
      return;
    }
    drawChar(ctx, sheet, e.dir, frameOf(e), x, y);
  };
}
function removeCostume(g) {
  const p = g.map.player;
  p.sprite = null;
  p.toeiCostume = null;
}
const costumeOf = (g) => g.map.player.toeiCostume || null;

// Effects drawn on top of the map (room.drawOver).
let FX = [];
function addFx(g, kind, x, y, life, extra = {}) { FX.push({ kind, x, y, t0: g.frame, life, ...extra }); }
const F = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function pdisc(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  const rr = Math.round(r);
  for (let y = -rr; y <= rr; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, rr * rr - y * y)));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}
function drawFx(ctx, g, cam) {
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i];
    const t = g.frame - f.t0;
    if (t < 0 || t > f.life) { FX.splice(i, 1); continue; }
    const x = f.screen ? f.x : f.x - cam.x;
    const y = f.screen ? f.y : f.y - cam.y;
    if (f.kind === 'spark') {
      const len = Math.round(3 + 7 * (1 - t / f.life));
      ctx.fillStyle = t % 4 < 2 ? '#ffffff' : '#fff6a8';
      ctx.fillRect(Math.round(x - len), Math.round(y), len * 2 + 1, 1);
      ctx.fillRect(Math.round(x), Math.round(y - len), 1, len * 2 + 1);
      for (let d = 1; d < len * 0.7; d++) {
        ctx.fillRect(Math.round(x - d), Math.round(y - d), 1, 1); ctx.fillRect(Math.round(x + d), Math.round(y - d), 1, 1);
        ctx.fillRect(Math.round(x - d), Math.round(y + d), 1, 1); ctx.fillRect(Math.round(x + d), Math.round(y + d), 1, 1);
      }
    } else if (f.kind === 'slash') {
      const k = t / f.life;
      ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
      for (let d = -14; d <= 14; d++) ctx.fillRect(Math.round(x + d), Math.round(y - d * 0.6), 2, 1);
    } else if (f.kind === 'flash') {
      ctx.fillStyle = `rgba(255,255,255,${(1 - t / f.life) * 0.75})`;
      ctx.fillRect(0, 0, W, H);
    } else if (f.kind === 'boom') {
      if (t < 30) {
        const r = Math.min(24, 4 + t * 1.3);
        pdisc(ctx, x, y, r, t < 6 ? '#ffffff' : t < 16 ? '#ffb23a' : '#e8582a');
        pdisc(ctx, x, y - 1, r * 0.7, t < 10 ? '#ffffff' : '#ffd23f');
        if (t > 8) pdisc(ctx, x, y - 2, r * 0.35, '#fff6a8');
      }
      if (t > 16) {
        const a = Math.max(0, 0.75 - (t - 16) / (f.life - 16));
        for (let k = 0; k < 5; k++) pdisc(ctx, x + (k - 2) * 8, y - (t - 16) * 0.5 - (k % 2) * 6, 6 + (t - 16) * 0.12, `rgba(80,80,92,${a})`);
      }
      for (let k = 0; k < 10; k++) {
        const ang = k * Math.PI / 5 + 0.3;
        const d = t * 2.1;
        if (d > 60) continue;
        F(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.6 - 10 + t * t * 0.03, 2, 2, k % 2 ? '#5a4e40' : '#ffd23f');
      }
    } else if (f.kind === 'confetti') {
      const cols = ['#ffd23f', '#ff7eb6', '#5fd7ff', '#5ee07a', '#ff8a3d', '#ffffff'];
      for (let k = 0; k < 80; k++) {
        const px = (((k * 47 + Math.sin((t + k * 13) / 9) * 10) % W) + W) % W;
        const py = ((t * (0.9 + (k % 5) * 0.18) + k * 29) % (H + 20)) - 10;
        F(ctx, px, py, (t + k) % 10 < 5 ? 3 : 1, 2, cols[k % cols.length]);
      }
    }
  }
}
function clash(g, x, y) {
  g.sfx('sword');
  addFx(g, 'spark', x, y, 14);
  g.shake(6, 1);
}

// Prop helpers (main canvas).
function plate(x, y, w, label, opt = {}) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy) {
      const pw = Math.round(w * TILE), ph = 13, oy = opt.dy ?? 2;
      F(ctx, sx, sy + oy, pw, ph, '#20232a');
      F(ctx, sx + 1, sy + oy + 1, pw - 2, ph - 2, opt.bg || '#2a3560');
      text(ctx, label, sx + pw / 2, sy + oy + 1, { size: 10, align: 'center', color: opt.color || '#ffffff', shadow: null });
    },
  };
}

// 軒先に掛かったお店の看板（オープンセット用）。cx = 中心のタイル列。
function kanban(cx, label) {
  return {
    type: 'prop', x: Math.floor(cx), y: 2, w: 1, h: 1, solid: false,
    draw(ctx, sx, sy) {
      const bw = label.length * 10 + 6, bx = Math.round(sx + (cx - Math.floor(cx)) * TILE + 8 - bw / 2), by = sy + 8;
      F(ctx, bx + 3, by - 3, 1, 3, '#2a1c14'); F(ctx, bx + bw - 4, by - 3, 1, 3, '#2a1c14');
      F(ctx, bx, by, bw, 13, '#2a1c14');
      F(ctx, bx + 1, by + 1, bw - 2, 11, '#d9bf86');
      F(ctx, bx + 1, by + 1, bw - 2, 1, '#ecd9a8');
      text(ctx, label, bx + bw / 2, by + 1, { size: 10, align: 'center', color: '#20140c', shadow: null });
    },
  };
}

// =====================================================================
// jobs & lessons
// =====================================================================
const VOICE_WORDS = [
  { word: '刹那', reading: 'せつな', wrong: ['さつな', 'せつだ', 'きりな'], sentence: '「その刹那、光が走った――！」' },
  { word: '黄昏', reading: 'たそがれ', wrong: ['きぐれ', 'おうひ', 'こがね'], sentence: '「黄昏の空に、約束を誓おう」' },
  { word: '陽炎', reading: 'かげろう', wrong: ['ひかげ', 'ようか', 'ひのほ'], sentence: '「陽炎の向こうに、あいつの影が…！」' },
  { word: '東雲', reading: 'しののめ', wrong: ['ひがしぐも', 'あずまぐも', 'しのぐも'], sentence: '「東雲の空が、旅立ちを告げている」' },
  { word: '十六夜', reading: 'いざよい', wrong: ['いざなぎ', 'とおろくよ', 'いさよし'], sentence: '「十六夜の月が、ぼくらを照らす」' },
  { word: '五月雨', reading: 'さみだれ', wrong: ['ごがつう', 'さみあめ', 'いつきあめ'], sentence: '「五月雨の中、二人は再会した」' },
  { word: '狼煙', reading: 'のろし', wrong: ['おおかみび', 'ろうけむ', 'のろび'], sentence: '「反撃の狼煙を上げろ！」' },
  { word: '漣', reading: 'さざなみ', wrong: ['なみだ', 'さなみ', 'ささらぎ'], sentence: '「漣の音が、心をしずめてくれる」' },
];
const AUDITION_SCENES = [
  { prompt: '審査員「主人公の第一声。冒険の始まりを元気よく！」', answers: [{ text: '「よーし、行くぞ！」', score: 100 }, { text: '「…まあ、行くか」', score: 45 }, { text: '「家に帰りたい…」', score: 10 }] },
  { prompt: '審査員「次は、仲間とお別れするシーン。」', answers: [{ text: '「また、きっと会おうな」', score: 100 }, { text: '「じゃ、おつかれっす！」', score: 30 }, { text: '「さよならーー！！」', score: 55 }] },
  { prompt: '審査員「悪役の高笑いもお願いします！」', answers: [{ text: '「フハハハハハ！」', score: 100 }, { text: '「ふふっ…（照れ）」', score: 35 }, { text: '「わはは…すみません」', score: 15 }] },
  { prompt: '審査員「ピンチの仲間を助けに来た！決めゼリフ！」', answers: [{ text: '「待たせたな！」', score: 100 }, { text: '「あ、どうも…」', score: 20 }, { text: '「遅れてごめーん」', score: 45 }] },
];

const JOBS = {
  extra: {
    // the 殺陣 minigame has the player fighting the villains, so the extra is a 若侍 who joins the hero's fight
    id: 'toei_extra', title: '時代劇の立ち回りエキストラ', desc: '主役に加勢する若侍の役で出演！', client: '助監督', clientLook: LK.ad,
    stamina: 15, minigame: 'command', opts: { theme: 'tate', difficulty: 1 }, pay: 1000, fame: 5, skill: 'engi', gain: 1,
  },
  kirare: {
    id: 'toei_kirare', title: '時代劇の斬られ役', desc: '主役に斬られる大事な役でござる。', client: '殺陣師', clientLook: LK.tateshi,
    stamina: 20, minigame: 'command', opts: { theme: 'tate', difficulty: 2 }, pay: 4500, fame: 15, skill: 'engi', gain: 2,
    requires: { anyOf: [{ agency: true }, { fame: 30 }] },
  },
  suit: {
    id: 'toei_suit', title: '特撮ヒーローのスーツアクター', desc: 'スーツを着て大立ち回り！', client: 'アクション監督', clientLook: LK.action,
    stamina: 25, minigame: 'command', opts: { theme: 'henshin', difficulty: 3 }, pay: 12000, fame: 45, skill: 'engi', gain: 3,
    requires: { fame: 250 },
  },
  voice: {
    id: 'toei_voice', title: 'アニメのアフレコ出演', desc: '台本どおり、正しく読もう！', client: '音響監督', clientLook: LK.onkan,
    stamina: 20, minigame: 'announce',
    opts: { set: 'afureko', show: 'ドット冒険記', difficulty: 3, words: VOICE_WORDS, count: 6, howto: ['アニメのアフレコ本番！', '台本のむずかしい言葉を、正しく読もう。読み間違えたらNGだ！'] },
    pay: 11000, fame: 40, skill: 'talk', gain: 3,
    requires: { fame: 250, flag: 'toei_voice_role', flagText: 'まずは声優オーディションに合格しないと。\n音響監督さんに話しかけてみよう。' },
  },
  lead: {
    id: 'toei_lead', title: '時代劇の主役', desc: '連続時代劇の主演をたのむぞ！', client: '監督', clientLook: LK.kantoku,
    stamina: 30, minigame: 'command', opts: { theme: 'tate', difficulty: 4 }, pay: 30000, fame: 110, skill: 'engi', gain: 4,
    requires: { fame: 1000 },
  },
  movie: {
    id: 'toei_movie', title: '劇場版ヒーロー映画の主演', desc: '劇場版の主演に大抜擢！', client: 'プロデューサー', clientLook: LK.producer,
    stamina: 30, minigame: 'command', opts: { theme: 'henshin', difficulty: 5 }, pay: 65000, fame: 220, skill: 'engi', gain: 5,
    requires: { fame: 2000 },
  },
};
const LESSON_TATE = { title: '殺陣レッスン', skill: 'engi', price: 3000, stamina: 12, gain: 4, minigame: 'command', opts: { theme: 'tate', difficulty: 1 }, teacher: '殺陣師' };
const LESSON_ACTION = { title: 'アクション講座', skill: 'engi', price: 6000, stamina: 15, gain: 5, minigame: 'command', opts: { theme: 'henshin', difficulty: 2 }, teacher: 'アクション監督' };
const good = (res) => res && (res.rank === 'S' || res.rank === 'A');

// Lessons: the teacher tells you the fee in character when you can't pay it
// (instead of the generic engine line), otherwise gives the intro and starts.
async function teach(g, npc, def, intro, broke) {
  const o = who(npc);
  if (g.state.money < def.price) { await g.say(broke(fmtMoney(def.price)), o); return null; }
  await g.say(intro, o);
  return g.lesson(def);
}

// 斬られ役 (tier 1): agency members or ★30, same rule as JOBS.kirare.requires
const kirareOk = (g) => !!g.state.agency || g.state.fame >= 30;

function nextHint(g) {
  const f = g.state.fame;
  if (f < 30 && !g.state.agency) return ['まずは左奥の木戸から、時代劇のオープンセットへ行ってごらん。', '立ち回りのエキストラなら、だれでも出られるよ！殺陣のレッスンもあるからね。'];
  if (f < 250) return ['そろそろ斬られ役の声がかかるころだね。', 'オープンセットの殺陣師さんに話しかけてごらん。'];
  if (f < 1000) return ['注目株だね！特撮スタジオのスーツアクターや、', 'アフレコスタジオの声優オーディションに挑戦できるよ。'];
  if (f < 2000) return ['オープンセットの監督が、時代劇の主役をさがしてたよ。', '今の君なら、きっと声がかかる！'];
  return ['特撮スタジオのプロデューサーが、劇場版ヒーロー映画の主演をさがしてるって！', 'スターの君にぴったりの大仕事だよ！'];
}

async function scheduleBoard(g) {
  const f = g.state.fame;
  const m = (ok) => (ok ? '◎' : '×');
  await g.say([
    '【本日の撮影スケジュール】\n◎時代劇　立ち回りエキストラ（どなたでも）\n◎殺陣レッスン・アクション講座',
    `${m(kirareOk(g))}時代劇　斬られ役（所属か★30〜）\n${m(f >= 250)}特撮　スーツアクター（★250〜）\n${m(f >= 250)}アニメ声優オーディション（★250〜）`,
    `${m(f >= 1000)}時代劇　主役（★1000〜）\n${m(f >= 2000)}劇場版ヒーロー映画　主演（★2000〜）`,
  ]);
}

async function kosatsu(g) {
  const f = g.state.fame;
  const m = (ok) => (ok ? '◎' : '×');
  await g.say([
    '高札（こうさつ）に、おふれ書きが貼ってある。',
    `【おふれ】\n◎立ち回りエキストラ　どなたでも\n${m(kirareOk(g))}斬られ役　事務所所属か★30より`,
    `${m(f >= 1000)}時代劇の主役　知名度★1000より\n右、助監督・殺陣師・監督まで\n申し出るべし。　撮影所`,
  ]);
}

// =====================================================================
// cutscenes
// =====================================================================
// 殺陣のリハーサル: two samurai clash, one falls dramatically.
async function rehearsal(g, first) {
  const ronin = g.npc('toei_ronin'), waka = g.npc('toei_waka'), tate = g.npc('toei_tateshi');
  if (!ronin || !waka || !tate) return;
  const T = nm('殺陣師', LK.tateshi);
  const RY = ronin.def.y;
  await g.fadeOut(10);
  ronin.sprite = swordSprite(ronin.look);
  waka.sprite = swordSprite(waka.look);
  homePos(ronin); homePos(waka); homePos(tate);
  g.placePlayer(12, RY + 2, 'up');
  await g.fadeIn(10);
  await g.say(['それでは、殺陣のリハーサルを始めるでござる！', '本番のつもりで、気合いを入れていくでござるよ！'], T);
  g.sfx('snare');
  await g.say('よーい……スタート！', T);
  await g.wait(250);
  await Promise.all([g.moveNpc('toei_ronin', 'right', 1.2), g.moveNpc('toei_waka', 'left', 1.2)]);
  await g.emote('toei_ronin', '💢', 36);
  // 1st clash
  await Promise.all([g.moveNpc('toei_ronin', 'right', 2.6), g.moveNpc('toei_waka', 'left', 2.6)]);
  clash(g, 13 * TILE, RY * TILE + 2);
  await g.wait(300);
  await Promise.all([g.moveNpc('toei_ronin', ['left', 'face:right'], 2), g.moveNpc('toei_waka', ['right', 'face:left'], 2)]);
  await g.wait(250);
  // 2nd: a quick exchange
  await Promise.all([g.moveNpc('toei_ronin', 'right', 2.6), g.moveNpc('toei_waka', 'left', 2.6)]);
  for (let i = 0; i < 3; i++) {
    clash(g, 13 * TILE + (i - 1) * 2, RY * TILE - 1 + i * 3);
    await g.wait(170);
  }
  await g.wait(250);
  // the young samurai slips past with one stroke
  const pass = g.moveNpc('toei_waka', ['up', 'left', 'left', 'down', 'face:left'], 3);
  await g.wait(110);
  g.sfx('sword');
  addFx(g, 'flash', 0, 0, 12, { screen: true });
  addFx(g, 'slash', 12 * TILE + 8, RY * TILE + 4, 18);
  await pass;
  await g.wait(600);
  ronin.dir = 'down';
  await g.emote('toei_ronin', '…', 60);
  for (const d of ['left', 'up', 'right', 'down', 'left', 'up', 'right', 'down']) { ronin.dir = d; await g.wait(60); }
  g.sfx('hit');
  ronin.sprite = lyingSprite(ronin.look);
  g.shake(10, 2);
  await g.wait(700);
  g.sfx('good');
  await g.emote('toei_waka', '…', 40);
  await g.say('カーーット！！', T);
  g.sfx('applause');
  await g.say('見事！最高の立ち回りでござった！', T);
  ronin.sprite = swordSprite(ronin.look);
  ronin.dir = 'left';
  waka.dir = 'right';
  await g.emote('toei_ronin', 'w');
  await g.say(['いやあ、今日の斬られっぷり、どうでした？', '倒れるまでが、斬られ役の見せ場でさあ！'], nm('ベテラン斬られ役', LK.ronin));
  await g.emote('toei_waka', '♪');
  await g.say('せ、先輩、ありがとうございました！', nm('若手俳優', LK.waka));
  if (g.flag('toei_watch_day') !== g.state.day) {
    g.setFlag('toei_watch_day', g.state.day);
    g.addSkill('engi', 1);
    await g.say('本物の立ち回りを間近で見て、とても勉強になった！');
  }
  await g.fadeOut(10);
  ronin.sprite = null; waka.sprite = null;
  homePos(ronin); homePos(waka); homePos(tate);
  await g.fadeIn(10);
  if (first) {
    await g.say(['どうでした？すごい迫力でしょう！', 'エキストラのお仕事や、殺陣のレッスンもありますよ。', 'お仕事なら僕に、レッスンなら殺陣師の先生に声をかけてくださいね！'], nm('助監督', LK.ad));
  }
}

// 爆破テスト in the tokusatsu studio.
async function explosionShow(g) {
  const O = nm('火薬担当', LK.pyro);
  const p = g.map.player;
  const back = { x: p.x, y: p.y, dir: p.dir };
  await g.fadeOut(10);
  setPos(g.npc('toei_kaijin'), 7, 4, 'down');
  g.placePlayer(8, 8, 'up');
  await g.fadeIn(10);
  await g.say(['爆破テスト、いきまーす！', '周りの安全、よし！怪人さん、ポーズお願いしまーす！'], O);
  await g.emote('toei_kaijin', '♪', 40);
  for (const n of ['3', '2', '1']) {
    g.sfx('cursor');
    g.notify(n, { color: '#ffffff', life: 28 });
    await g.wait(480);
  }
  g.notify('点火！', { color: '#ff8a3d', life: 40 });
  g.sfx('hit');
  addFx(g, 'boom', 6 * TILE + 8, 3 * TILE + 6, 70);
  addFx(g, 'flash', 0, 0, 10, { screen: true });
  g.shake(30, 4);
  await g.wait(160);
  g.sfx('drum');
  addFx(g, 'boom', 9 * TILE + 8, 3 * TILE + 6, 70);
  await g.wait(160);
  g.sfx('hit');
  addFx(g, 'boom', 8 * TILE, 2 * TILE + 12, 70);
  g.shake(20, 3);
  await g.wait(1000);
  await g.emote('toei_kaijin', '!');
  await g.say('グワーッ！…お、おのれピクセリオン〜！', nm('怪人役', LK.kaijin));
  await g.say('はい、オッケーでーす！今日もいい爆発でした！', O);
  await g.emote('player', '!');
  await g.say('すごい迫力だった！\n（爆発の中でもポーズをくずさない…これがプロか！）');
  await g.fadeOut(10);
  g.placePlayer(back.x, back.y, back.dir);
  await g.fadeIn(10);
}

// After the tier-3 lead role.
async function leadCelebration(g, res) {
  const K = nm('監督', LK.kantoku);
  await g.say('カーーット！！', K);
  g.sfx('applause');
  await Promise.all(['toei_tateshi', 'toei_ad', 'toei_ronin', 'toei_waka', 'toei_musume', 'toei_chonin'].map((id) => g.emote(id, '♪', 50)));
  await g.say(good(res)
    ? ['…見事じゃ。', '刀さばきのキレ、背中で語る芝居…まさに主役の芝居じゃった！']
    : ['うむ、ちと固かったが…気迫は伝わってきたぞ。', '回を重ねれば、もっと良くなる。それが主役というものじゃ。'], K);
  if (!g.flag('toei_lead_done')) {
    g.setFlag('toei_lead_done');
    await g.say('初主演、おめでとうござる！\n拙者も鼻が高いでござるよ！', nm('殺陣師', LK.tateshi));
    await g.emote('toei_ronin', 'w');
    await g.say('主役に斬られるのは、斬られ役のほまれでさあ！', nm('ベテラン斬られ役', LK.ronin));
  }
}

// After the tier-4 movie: crank-up celebration with confetti.
async function movieCelebration(g, res) {
  const PR = nm('プロデューサー', LK.producer);
  const p = g.map.player;
  const back = { x: p.x, y: p.y, dir: p.dir };
  const spots = {
    toei_producer: [6, 7, 'up'], toei_action: [8, 7, 'up'], toei_suitactor: [5, 6, 'right'],
    toei_kaijin: [9, 6, 'left'], toei_pyro_staff: [4, 7, 'up'], toei_cameraman: [10, 7, 'up'],
  };
  await g.say('カーーット！！…OK！！', nm('アクション監督', LK.action));
  await g.fadeOut(12);
  for (const [id, [x, y, d]] of Object.entries(spots)) setPos(g.npc(id), x, y, d);
  g.placePlayer(7, 5, 'down');
  await g.fadeIn(12);
  await g.say('劇場版『光速ヒーロー ピクセリオン 銀河の決戦』…\nこれにて、クランクアップです！！', PR);
  g.sfx('applause');
  addFx(g, 'confetti', 0, 0, 260, { screen: true });
  await Promise.all(Object.keys(spots).map((id) => g.emote(id, '♪', 60)));
  await g.say(['{name}さん、主演おつかれさまでした！', good(res) ? '最高のヒーローでした！この映画は、きっと子どもたちの宝物になります！' : '最後まで全力のヒーローでした！公開が楽しみです！'], PR);
  await g.emote('toei_kaijin', 'w');
  await g.say('いやあ、最後の必殺技、本気でやられたと思いましたよ！', nm('怪人役', LK.kaijin));
  await g.emote('toei_suitactor', '!');
  await g.say('（スーツアクターさんが、ビシッと敬礼してくれた！）');
  if (!g.flag('toei_movie_done')) {
    g.setFlag('toei_movie_done');
    await g.say('これは、スタッフ全員のサイン入りカチンコです。記念にどうぞ！', PR);
    g.giveItem('toei_clapper');
  } else {
    await g.say('スタッフ一同から、花束です！また一緒にやりましょう！', PR);
  }
  g.sfx('fanfare');
  await g.emote('player', '♥');
  await g.showLogo('toei', '劇場版、全国の映画館で公開！');
  await g.fadeOut(12);
  for (const id of Object.keys(spots)) homePos(g.npc(id));
  g.placePlayer(back.x, back.y, back.dir);
  await g.fadeIn(12);
}

// 声優オーディション（talk minigame）。合格するとアフレコの仕事ができる。
async function voiceAudition(g, npc) {
  const o = who(npc);
  if (g.state.fame < 250) {
    await g.say(['新作アニメのオーディションは、ある程度経験のある人が対象なんだ。', '★250になったら、また来てね。それまでは、ブースのマイクで発声練習をしておくといいよ。'], o);
    return;
  }
  if (g.flag('toei_voice_aud_day') === g.state.day) {
    await g.say('オーディションは1日1回まで。\nまた明日、挑戦してね！', o);
    return;
  }
  const i = await g.ask(['新作アニメ『ドット冒険記』の声優オーディション、受けてみる？', '（体力 -15・1日1回）'], ['受ける', 'やめておく'], o);
  if (i !== 0) return;
  if (!g.useStamina(15)) { await g.say('体力が足りない…。\n声がかすれちゃう。休んでからにしよう。'); return; }
  g.setFlag('toei_voice_aud_day', g.state.day);
  const res = await g.minigame('talk', {
    difficulty: 3, skill: 'engi', pass: 55, title: 'アニメ声優オーディション', topic: 'アニメ声優オーディション',
    scenes: AUDITION_SCENES, howto: ['審査員のお題に合わせて、', 'いちばんキャラクターらしい演じ方を選ぼう！'],
  });
  if (res.score < 55) {
    await g.say([
      res.score >= 45 ? `うーん、おしい！（${res.score}点／合格ライン55点）` : `今回は見送りかな…。（${res.score}点／合格ライン55点）`,
      res.score >= 45 ? 'あと一歩だよ。キャラクターの気持ちを想像して、また明日おいで。' : 'ブースのマイクで発声練習をして、また明日挑戦してね。',
    ], o);
    return;
  }
  g.setFlag('toei_voice_role');
  g.sfx('fanfare');
  g.addFame(15);
  await g.say(['合格！主人公の相棒役は、君に決まりだ！', 'これからアフレコのお仕事、よろしくね！'], o);
}

// =====================================================================
// rooms
// =====================================================================
async function leaveCheck(g) {
  if (costumeOf(g)) {
    await g.say(['おっと、衣装は撮影所の外には持ち出せないよ。', 'こっちで衣装部に返しておくね！'], nm('守衛さん', LK.guard));
    removeCostume(g);
  }
  return true;
}

// ---------------------------------------------------------------- gate
const GATE_MARKS = [[2.5, '衣装部'], [5, '時代劇'], [15, '特撮'], [17.5, 'アフレコ']];
const gate = {
  floor: 'toei_lot',
  bg: '#1c1e24',
  bgm: 'studio',
  // 路面に白ペンキで書かれた行き先表示
  drawUnder(ctx, g, cam) {
    for (const [cx, label] of GATE_MARKS) {
      const x = Math.round(cx * TILE - cam.x), y = 3 * TILE - cam.y;
      ctx.globalAlpha = 0.8;
      text(ctx, label, x, y + 4, { size: 10, align: 'center', color: '#f4f4ee', shadow: null });
      for (let i = 0; i < 3; i++) F(ctx, x - 1 - i, y + 1 + i, 3 + i * 2, 1, '#f4f4ee');
      ctx.globalAlpha = 1;
    }
  },
  tiles: [
    '####################',
    '#==={}=======o=====#',
    '#jda<>h======BDD=Fw#',
    '#......K....K......#',
    '#......KKKKKK......#',
    '#..................#',
    '#..................#',
    '#..............GGZ.#',
    '#P.............G.Z.#',
    '#.bb...........crc.#',
    '#.................V#',
    '#.................P#',
    '#y.........T-]...xX#',
    '#########MM#########',
  ],
  legend: {
    '#': 'toei_studio_top', '=': 'toei_studio_wall', w: 'toei_studio_wall+window',
    '{': 'toei_kido_top_l', '}': 'toei_kido_top_r', '<': 'toei_kido_l', '>': 'toei_kido_r',
    j: 'toei_studio_wall+toei_poster_jidai', h: 'toei_studio_wall+toei_poster_hero', a: 'toei_studio_wall+toei_poster_anime',
    d: 'toei_door_wood', D: 'toei_door_stage', F: 'toei_door_snd', B: 'toei_studio_wall+whiteboard', o: 'toei_studio_wall+onair',
    P: 'plant', K: 'counter_white', V: 'vending', G: 'shelf_goods', Z: 'fridge_drinks', c: 'counter', r: 'register', b: 'bench',
    y: 'bicycle', T: 'toei_barrier_post', '-': 'toei_barrier_arm', ']': 'toei_barrier_end', x: 'boxes', X: 'box',
  },
  warps: [
    { x: 9, y: 13, to: 'exit', check: leaveCheck },
    { x: 10, y: 13, to: 'exit', check: leaveCheck },
    { x: 2, y: 2, room: 'costume', tx: 6, ty: 9, dir: 'up' },
    { x: 4, y: 2, room: 'openset', tx: 12, ty: 15, dir: 'up' },
    { x: 5, y: 2, room: 'openset', tx: 13, ty: 15, dir: 'up' },
    { x: 14, y: 2, room: 'tokusatsu', tx: 9, ty: 11, dir: 'up' },
    { x: 15, y: 2, room: 'tokusatsu', tx: 10, ty: 11, dir: 'up' },
    { x: 17, y: 2, room: 'afureko', tx: 7, ty: 10, dir: 'up' },
  ],
  entities: [
    { type: 'logo', x: 7.75, y: 0.2, w: 4.5, h: 2.7, logo: 'toei', lights: true },
    plate(14, 1, 2, '特撮', { bg: '#a8202c' }),
    plate(16.25, 1, 2.5, 'アフレコ', { bg: '#3a3f54' }),
    {
      // 受付カウンターの上の小さな看板
      type: 'prop', x: 7, y: 4, w: 6, h: 1, solid: false, z: -8,
      draw(ctx, sx, sy) {
        F(ctx, sx + 33, sy + 3, 30, 13, '#20232a');
        F(ctx, sx + 34, sy + 4, 28, 11, '#f6f6f8');
        text(ctx, '受付', sx + 48, sy + 4, { size: 10, align: 'center', color: '#2a3560', shadow: null });
      },
    },
    {
      // ヒーローの像
      type: 'prop', x: 2, y: 5, w: 2, h: 2,
      text: ['「光速ヒーロー ピクセリオン」の等身大フィギュアだ。', '台座に「子どもたちの夢を守れ！」と刻まれている。'],
      draw(ctx, sx, sy, g) {
        F(ctx, sx + 3, sy + 18, 26, 13, '#8e929c'); F(ctx, sx + 3, sy + 18, 26, 2, '#c9ccd4'); F(ctx, sx + 3, sy + 29, 26, 2, '#6d7078');
        F(ctx, sx + 10, sy + 22, 12, 5, '#c9a227'); F(ctx, sx + 11, sy + 23, 10, 1, '#fff6a8');
        F(ctx, sx + 11, sy + 8, 4, 10, '#f2f2f2'); F(ctx, sx + 17, sy + 8, 4, 10, '#e2e2e2');
        F(ctx, sx + 11, sy + 15, 4, 3, '#d62f2f'); F(ctx, sx + 17, sy + 15, 4, 3, '#b8282a');
        F(ctx, sx + 10, sy - 4, 12, 12, '#d62f2f'); F(ctx, sx + 18, sy - 4, 4, 12, '#b8282a');
        F(ctx, sx + 14, sy - 2, 4, 4, '#ffd23f');
        F(ctx, sx + 10, sy + 6, 12, 2, '#c0c4cc'); F(ctx, sx + 15, sy + 6, 2, 2, '#ffd23f');
        F(ctx, sx + 22, sy - 14, 3, 12, '#d62f2f'); F(ctx, sx + 21, sy - 18, 5, 4, '#f2f2f2');
        F(ctx, sx + 7, sy - 3, 3, 9, '#d62f2f'); F(ctx, sx + 7, sy + 5, 3, 3, '#f2f2f2');
        F(ctx, sx + 11, sy - 14, 10, 10, '#d62f2f'); F(ctx, sx + 12, sy - 11, 8, 4, '#20232a'); F(ctx, sx + 13, sy - 11, 3, 1, '#5fd7ff');
        F(ctx, sx + 14, sy - 6, 4, 1, '#c0c4cc');
        F(ctx, sx + 12, sy - 17, 1, 3, '#ffd23f'); F(ctx, sx + 19, sy - 17, 1, 3, '#ffd23f');
        const wave = Math.floor(g.frame / 12) % 2;
        F(ctx, sx + 4, sy - 4 + wave, 6, 2, '#ffd23f'); F(ctx, sx + 2, sy - 3 + wave * 2, 3, 2, '#ffd23f');
      },
    },
    {
      // 売店の屋根
      type: 'prop', x: 15, y: 6, w: 3, h: 1,
      draw(ctx, sx, sy) {
        F(ctx, sx + 1, sy + 10, 2, 22, '#9aa0aa'); F(ctx, sx + 45, sy + 10, 2, 22, '#9aa0aa');
        F(ctx, sx - 1, sy + 1, 50, 11, '#ffffff');
        for (let i = 0; i < 6; i++) F(ctx, sx - 1 + i * 8, sy + 1, 4, 11, '#d62f2f');
        for (let i = 0; i < 12; i++) F(ctx, sx + i * 4, sy + 12, 3, 2, i % 2 ? '#ffffff' : '#d62f2f');
        F(ctx, sx + 11, sy - 8, 26, 11, '#20232a'); F(ctx, sx + 12, sy - 7, 24, 9, '#2a3560');
        text(ctx, '売店', sx + 24, sy - 8, { size: 10, align: 'center', color: '#ffd23f', shadow: null });
      },
    },
    {
      // 守衛所
      type: 'prop', x: 6, y: 11, w: 2, h: 2,
      text: '守衛所だ。モニターで撮影所の中を見守っている。',
      draw(ctx, sx, sy, g) {
        F(ctx, sx + 1, sy + 3, 30, 28, '#e8ecf2'); F(ctx, sx + 1, sy + 29, 30, 2, '#9aa0aa'); F(ctx, sx + 29, sy + 3, 2, 26, '#c9ced8');
        F(ctx, sx - 1, sy - 2, 34, 6, '#2f4f8a'); F(ctx, sx - 1, sy + 4, 34, 1, '#1f3560'); F(ctx, sx - 1, sy - 2, 34, 1, '#4a6aa8');
        F(ctx, sx + 4, sy + 7, 24, 11, '#20232a'); F(ctx, sx + 5, sy + 8, 22, 9, '#a8dcf5'); F(ctx, sx + 6, sy + 9, 6, 2, '#e0f4ff');
        F(ctx, sx + 16, sy + 12, 8, 5, '#3b3f48'); F(ctx, sx + 17, sy + 13, 6, 3, Math.floor(g.frame / 30) % 2 ? '#5fd7ff' : '#5ee07a');
        F(ctx, sx + 1, sy + 19, 30, 11, '#2a3560');
        text(ctx, '守衛所', sx + 16, sy + 19, { size: 10, align: 'center', color: '#ffffff', shadow: null });
        F(ctx, sx + 14, sy - 6, 4, 4, Math.floor(g.frame / 40) % 2 ? '#ff2b3a' : '#7a1f1f');
      },
    },
    { type: 'sign', x: 13, y: 2, talk: scheduleBoard },
    { type: 'sign', x: 11, y: 12, text: '車両用のゲートだ。ロケバスや機材のトラックは、ここから出入りする。' },
    { type: 'sign', x: 17, y: 12, text: '撮影機材の段ボールが積まれている。「ワレモノ注意」のシールがびっしり。' },

    {
      type: 'npc', id: 'toei_guard', x: 8, y: 12, dir: 'right', look: LK.guard, name: '守衛さん',
      talk: async (g, npc) => {
        const o = who(npc);
        if (costumeOf(g)) await g.say(['おっ、衣装を着てるね。よく似合ってるよ！', 'でも、衣装は撮影所の外には持ち出せないから、帰りにここで返してね。'], o);
        await g.say(['ここは東映 撮影所の正面ゲート。', '奥には時代劇のオープンセット、特撮スタジオ、アフレコスタジオ、それに衣装部があるよ。'], o);
        await g.say(nextHint(g), o);
      },
    },
    {
      type: 'npc', id: 'toei_uketsuke', x: 9, y: 3, dir: 'down', look: LK.uketsuke, name: '受付さん',
      talk: async (g, npc) => {
        const o = who(npc);
        const i = await g.ask('東映 撮影所へようこそ。\nご用件をどうぞ。', ['撮影所の案内', '今日のおすすめ', 'やめておく'], o);
        if (i === 0) {
          const j = await g.ask('どちらをご案内しましょう？', ['オープンセット', '特撮スタジオ', 'アフレコスタジオ', '衣装部', 'もどる'], o);
          const info = [
            ['左奥の木戸の先が、時代劇のオープンセットです。', 'この撮影所では、江戸の町並みも特撮も\nアニメの声の収録も、ぜんぶ一か所で\n撮れるんですよ。', '殺陣のレッスンや、エキストラのお仕事もあります。'],
            ['右奥の大きな扉が、特撮スタジオです。', 'ヒーロー番組を撮影中！迫力の爆破シーンも、ここで撮るんですよ。'],
            ['右端の扉が、アフレコスタジオです。', 'アニメの映像に合わせて、声優さんがセリフを吹き込む場所です。'],
            ['左端の扉が、衣装部です。', '時代劇の着物やかつら、ヒーローのスーツまで、なんでもそろってますよ。試着もできるかも？'],
          ][j];
          if (info) await g.say(info, o);
        } else if (i === 1) {
          await g.say(nextHint(g), o);
          await g.say('掲示板に、今日の撮影スケジュールも貼ってありますよ。', o);
        }
      },
    },
    {
      type: 'npc', id: 'toei_baiten', x: 16, y: 8, dir: 'down', look: LK.baiten, name: '売店のおばちゃん',
      talk: async (g, npc) => {
        await g.shop(['toei_lokeben', 'drink', 'daihon', 'toei_sofubi'], { title: '撮影所の売店', greeting: 'いらっしゃい！ロケ弁はうちの名物よ！' });
        await g.say(pick(['撮影は体力勝負！しっかり食べてね！', 'ロケ弁は、スタッフさんにも大人気なのよ。', '台本メモを読むと、演技のお仕事がちょっと楽になるわよ。']), who(npc));
      },
    },
    {
      type: 'npc', id: 'toei_veteran', x: 4, y: 9, dir: 'down', look: LK.veteran, name: 'ベテラン俳優',
      text: ['わしは時代劇ひとすじ四十年の役者じゃ。', '若いころは斬られ役ばかりでのう。斬られて斬られて…そのうち「斬られ方がうまい」と評判になった。', 'どんな小さな役でも、手を抜かんこと。それが一番の近道じゃよ。'],
    },
    {
      type: 'npc', id: 'toei_kengaku', x: 12, y: 7, dir: 'left', look: LK.tourist, name: '見学のお客さん', wander: 2,
      text: ['撮影所の見学ツアーに参加してるんです！', 'さっきオープンセットで殺陣のリハーサルを見たの。本物みたいな迫力だった〜！'],
    },
    {
      type: 'npc', id: 'toei_staff', x: 14, y: 5, dir: 'down', look: LK.staff, name: '美術スタッフ', wander: 1,
      text: ['ケーブル運び中です！足元に気をつけてくださいね。', 'オープンセットの町並みは、ぼくら美術スタッフの力作なんです。お店の看板まで手作りですよ！'],
    },
    {
      type: 'npc', id: 'toei_fan', x: 5, y: 7, dir: 'right', look: LK.fan, name: 'ファンの子',
      cond: (g) => g.state.fame >= 500,
      talk: async (g, npc) => {
        const o = who(npc);
        if (g.flag('toei_sign_day') === g.state.day) { await g.say('サイン、一生の宝物にします！', o); return; }
        await g.emote('toei_fan', '♥');
        const i = await g.ask(['あっ…！{name}さんですよね！？', 'テレビでいつも見てます！サインください！'], ['もちろん！', 'ごめんね'], o);
        if (i !== 0) { await g.say('そ、そうですよね…お仕事がんばってください！', o); return; }
        g.setFlag('toei_sign_day', g.state.day);
        g.sfx('good');
        g.addFame(2);
        await g.say('きゃー！ありがとうございます！\nみんなに自慢しちゃおう！', o);
      },
    },
  ],
  events: [
    {
      x: 1, y: 11, w: 18, on: 'step', once: 'toei_greeted',
      run: async (g) => {
        const o = nm('守衛さん', LK.guard);
        await g.emote('toei_guard', '!');
        await g.say(['いらっしゃい！東映 撮影所へようこそ！', '見学かい？それとも、お仕事かな？'], o);
        await g.showLogo('toei', '東映 撮影所');
        await g.say(['ここでは時代劇に特撮ヒーロー、アニメの声の収録まで、いろんな撮影をやってるんだ。', '奥の扉から、それぞれの撮影場所に行けるよ。受付で案内もしてるからね。'], o);
        await g.say(nextHint(g), o);
      },
    },
  ],
};

// ---------------------------------------------------------------- openset
const openset = {
  floor: 'toei_dirt',
  bg: '#1a120c',
  bgm: 'toei_edo',
  entry: { x: 12, y: 15, dir: 'up' },
  tiles: [
    '^^^^^^^^^^^^^^^^^^^^^^^^^^',
    'AAAAAaaaaaAAAAAaaaaaAAAAAA',
    'EEEEEeeeeeEEEEEeeeeeEEEEEE',
    'LCNCLSQnQSKKXKKLLuCLSQNNQS',
    'f..i......b...b...i..i...f',
    'f.......BD.............T.f',
    'f.w......................f',
    'f.................c......f',
    'f....................h...f',
    'f..k..............l......f',
    'f........................f',
    'f.y....y..........y....y.f',
    '~~~~~~~~~~~~[]~~~~~~~~~~~~',
    '------------[]------------',
    'f.xz..r...o....o.......vlf',
    'f........................f',
    'ffffffffffffMMffffffffffff',
  ],
  legend: {
    '^': 'toei_sky', A: 'toei_ridge', a: 'toei_ridge2', E: 'toei_eave', e: 'toei_eave2',
    L: 'toei_lattice', C: 'toei_lattice+toei_chochin', N: 'toei_noren', n: 'toei_noren_red', u: 'toei_noren_brown',
    S: 'toei_shoji', Q: 'toei_shoji+toei_chochin', K: 'toei_kura', X: 'toei_kura_door',
    f: 'toei_fence', i: 'toei_andon', b: 'toei_taru', B: 'toei_engi', D: 'toei_engi_tea', T: 'toei_tensui',
    w: 'toei_well', k: 'toei_kosatsu', y: 'toei_yanagi', c: 'camera', h: 'director_chair', l: 'spotlight',
    '~': 'toei_hori_top', '-': 'toei_hori', '[': 'toei_hashi_l', ']': 'toei_hashi_r',
    x: 'boxes', z: 'box', o: 'cone', r: 'toei_katana', v: 'vending',
  },
  warps: [
    { x: 12, y: 16, room: 'gate', tx: 4, ty: 3, dir: 'down' },
    { x: 13, y: 16, room: 'gate', tx: 5, ty: 3, dir: 'down' },
  ],
  drawOver: drawFx,
  onEnter: async () => { FX = []; },
  entities: [
    kanban(2, '呉服'), kanban(7, '茶屋'), kanban(17, 'そば'), kanban(22.5, '宿'),
    {
      // 茶屋の野点傘
      type: 'prop', x: 8, y: 5, w: 2, h: 1, solid: false, z: 4,
      draw(ctx, sx, sy) {
        const cx = sx + 16;
        F(ctx, cx - 1, sy - 16, 2, 26, '#5a3a20');
        for (let i = 0; i < 11; i++) { const hw = 3 + Math.round(i * 1.35); F(ctx, cx - hw, sy - 29 + i, hw * 2, 1, i < 3 ? '#e8586a' : '#c8323f'); }
        F(ctx, cx - 17, sy - 18, 34, 1, '#9a1f2c');
        for (const k of [-12, -6, 0, 6, 12]) F(ctx, cx + k, sy - 20, 1, 2, '#f6e6a8');
      },
    },
    { type: 'sign', x: 2, y: 6, text: '井戸だ。のぞきこむと…底はすぐそこ。撮影用の浅い井戸みたいだ。' },
    { type: 'sign', x: 3, y: 9, talk: kosatsu },
    { type: 'sign', x: 10, y: 4, text: '酒樽…に見えるけど、中は空っぽ。撮影用の小道具だ。' },
    { type: 'sign', x: 14, y: 4, text: '樽が積まれている。軽くたたくと、ポコンと軽い音がした。' },
    { type: 'sign', x: 8, y: 5, text: '茶屋の縁台。赤い野点傘（のだてがさ）が、江戸の町に映える。' },
    { type: 'sign', x: 9, y: 5, text: '赤い毛氈（もうせん）を敷いた縁台だ。お団子とお茶がのっている。' },
    { type: 'sign', x: 2, y: 3, text: '呉服屋ののれん。中をのぞくと…ハリボテだ！\nセットだから、お店の中は作られていないんだ。' },
    { type: 'sign', x: 12, y: 3, text: '立派な蔵の扉。押してもびくともしない…と思ったら、ただの板だった！' },
    { type: 'sign', x: 17, y: 3, text: 'そば屋ののれん。いいにおい…はしない。セットだもの。' },
    { type: 'sign', x: 23, y: 3, text: '宿屋ののれん。「お泊まりはこちら」…とあるが、ここはセット。泊まれない。' },
    { type: 'sign', x: 23, y: 5, text: '天水桶（てんすいおけ）。江戸の町では、火事にそなえて雨水をためていたんだって。' },
    { type: 'sign', x: 18, y: 7, text: '映画用のカメラだ。この一台で、江戸の町がスクリーンによみがえる。' },
    { type: 'sign', x: 21, y: 8, text: '監督のイス。背もたれに「監督」と書いてある。' },
    { type: 'sign', x: 6, y: 14, text: '撮影用の刀がずらり。本物そっくりだけど、竹光（たけみつ）だから軽いんだ。' },

    {
      type: 'npc', id: 'toei_tateshi', x: 12, y: 5, dir: 'down', look: LK.tateshi, name: '殺陣師',
      talk: async (g, npc) => {
        const o = who(npc);
        if (costumeOf(g) === 'samurai') await g.say('おお、その侍姿、なかなか様になっておるでござる！', o);
        const i = await g.ask('拙者は殺陣師。斬り合いの振り付けを考えるのが仕事でござる。何用かな？', ['殺陣レッスン', '斬られ役の仕事', '殺陣のコツ', 'やめておく'], o);
        if (i === 0) {
          await teach(g, npc, LESSON_TATE, 'よかろう。刀の握り方から、みっちり教えるでござる！',
            (price) => [`殺陣レッスンは、${price}でござる。`, 'まずはエキストラのお仕事で、稽古代をかせいでくるがよい。']);
        } else if (i === 1) {
          if (!kirareOk(g)) {
            await g.say(['斬られ役は、主役を引き立てる大事な役でござる。', 'まずはエキストラで場数を踏み、\n事務所に所属するか★30になったら\n来るがよい。'], o);
            return;
          }
          await g.say('うむ。見事に斬られてみせよ！\n倒れ方ひとつで、場面が生きるでござる。', o);
          const res = await g.job(JOBS.kirare);
          if (res) await g.say(good(res) ? '天晴れ！ほれぼれする斬られっぷりでござった！' : 'うむ、悪くない。精進するでござる。', o);
        } else if (i === 2) {
          await g.say(['殺陣は、本当に斬り合うのではない。相手と「呼吸」を合わせる芝居でござる。', '振る、受ける、斬られる…すべて段取りどおり。だからこそ安全で、美しい。', 'お仕事のときは、落ち着いてコマンドを入れるでござる。焦りは禁物！'], o);
        }
      },
    },
    {
      type: 'npc', id: 'toei_ronin', x: 10, y: 7, dir: 'right', look: LK.ronin, name: 'ベテラン斬られ役',
      text: ['斬られ役ひとすじ三十年。斬られた数なら、だれにも負けませんぜ。', 'コツはね、斬られる瞬間に「あっ、やられた」って顔をすること。', 'それから、倒れるときは受け身！ケガをしないのも、プロの仕事でさあ。'],
    },
    {
      type: 'npc', id: 'toei_waka', x: 15, y: 7, dir: 'left', look: LK.waka, name: '若手俳優',
      text: ['き、緊張するなあ…今日がはじめての立ち回りなんです。', '先生に「刀は振るんじゃない、運ぶんだ」って言われました。', 'いつか、主役を張れる役者になりたいなあ。'],
    },
    {
      type: 'npc', id: 'toei_ad', x: 11, y: 10, dir: 'down', look: LK.ad, name: '助監督',
      talk: async (g, npc) => {
        const o = who(npc);
        const i = await g.ask('助監督です！今日もバタバタです！\n何かご用ですか？', ['エキストラの仕事', 'リハーサル見学', '話を聞く', 'やめておく'], o);
        if (i === 0) {
          await g.say('エキストラは、どなたでも大歓迎！\n今日は、主役に加勢する若侍の役です。\n段取りどおり、悪党たちと立ち回ってくださいね！', o);
          const res = await g.job(JOBS.extra);
          if (res) await g.say(good(res) ? 'いい立ち回り！監督もほめてましたよ！' : 'おつかれさまでした！またお願いします！', o);
        } else if (i === 1) {
          await rehearsal(g, false);
        } else if (i === 2) {
          await g.say(['ここは時代劇のオープンセット。江戸の町並みを、まるごと作ってあるんです。', 'お店の中はハリボテだけど、映像で見ると本物そっくりなんですよ。', '高札（こうさつ）に今日の募集が貼ってあるので、見てみてください！'], o);
        }
      },
    },
    {
      type: 'npc', id: 'toei_kantoku', x: 20, y: 8, dir: 'left', look: LK.kantoku, name: '監督',
      talk: async (g, npc) => {
        const o = who(npc);
        const f = g.state.fame;
        if (f < 1000) {
          await g.say([
            'ん？見学かね。わしは時代劇の監督じゃ。',
            f < 250 ? 'いい役者になるには、まず脇役で経験を積むことじゃ。エキストラ、斬られ役…全部が修業じゃよ。' : 'ほう、少しは名が売れてきたようじゃな。',
            '★1000の売れっ子になったら、主役の話をしてやってもいいぞ。',
          ], o);
          return;
        }
        if (!g.flag('toei_lead_met')) {
          g.setFlag('toei_lead_met');
          await g.emote('toei_kantoku', '!');
          await g.say(['おお、君が噂の{name}くんか！', '次の連続時代劇『ドット侍 江戸日記』の主役をさがしておってな。ぜひ君に頼みたい！'], o);
        }
        if (g.state.agency === 'horipro') await g.say('ホリプロさんの所属だったね。\nお芝居の仕事、期待しとるよ。', o);
        else if (g.state.agency) await g.say('{agency}さんの所属じゃったな。\n時代劇にも、笑いと人情は欠かせんぞ。', o);
        if (costumeOf(g) === 'samurai') await g.say('おっ、もう衣装まで着とるのか。気合い十分じゃな！', o);
        const res = await g.job(JOBS.lead);
        if (res) await leadCelebration(g, res);
      },
    },
    {
      type: 'npc', id: 'toei_musume', x: 7, y: 4, dir: 'down', look: LK.musume, name: '茶屋の看板娘', person: 'chiyo',
      talk: async (g, npc) => {
        const o = who(npc);
        if (costumeOf(g) === 'musume') await g.say('あら、町娘さん！おそろいね〜！', o);
        await g.say('いらっしゃいまし〜！…なんてね。\nわたし、茶屋の娘役の女優なの。', o);
        await g.shop(['toei_dango', 'toei_ocha'], { title: '茶屋', greeting: 'お団子は撮影用じゃなくて、本物よ！' });
        await g.say('ひと休みしたら、また撮影がんばってね！', o);
      },
    },
    {
      type: 'npc', id: 'toei_chonin', x: 5, y: 8, dir: 'down', look: LK.chonin, name: '町人エキストラ', wander: 2,
      text: ['あっしは町人役のエキストラでさあ。', '立ち回りが始まったら「キャー！」って逃げるのが仕事。', '主役のジャマをしない逃げ方って、これが意外とむずかしいんですぜ。'],
    },
    {
      type: 'npc', id: 'toei_makeup', x: 8, y: 15, dir: 'up', look: LK.makeup, name: 'メイクさん',
      text: ['時代劇のメイクは、白ぬりやヒゲ付けなんかもあって奥が深いのよ。', '衣装部に行けば、着物やかつらを試着させてもらえるかもね。'],
    },
  ],
  events: [
    {
      x: 12, y: 11, w: 2, on: 'step', once: 'toei_rehearsal_seen',
      run: async (g) => {
        await g.say(['あっ、見学の方ですか？ちょうどいいところに！', 'これから殺陣のリハーサルなんです。よかったら見ていってください！'], nm('助監督', LK.ad));
        await rehearsal(g, true);
      },
    },
  ],
};

// ---------------------------------------------------------------- tokusatsu
const tokusatsu = {
  floor: 'toei_studio_floor',
  wall: 'dark',
  bg: '#101116',
  bgm: 'toei_hero',
  entry: { x: 9, y: 11, dir: 'up' },
  tiles: [
    '####################',
    '#===ssssssssoGGGGG=#',
    '#===cccccccc=GGGGG=#',
    '#L..RR*qq*RR.ggggg.#',
    '#...RqqqqqqR.ggggg.#',
    '#...qqqqqqqq.gggggx#',
    '#..................#',
    '#....C......C....L.#',
    '#..................#',
    '#..........mmh.....#',
    '#..................#',
    '#rby...........lll.#',
    '#########MM#########',
  ],
  legend: {
    o: 'wall_dark+onair', s: 'toei_bd_sky', c: 'toei_bd_cliff', G: 'green_screen', g: 'toei_green_floor',
    q: 'toei_gravel', R: 'toei_gravel+toei_rock', '*': 'toei_gravel+toei_pyro', L: 'spotlight', C: 'toei_camera_up',
    m: 'monitor', h: 'director_chair', r: 'toei_suit_red', b: 'toei_suit_blue', y: 'toei_suit_villain', l: 'locker', x: 'boxes',
  },
  warps: [
    { x: 9, y: 12, room: 'gate', tx: 14, ty: 3, dir: 'down' },
    { x: 10, y: 12, room: 'gate', tx: 15, ty: 3, dir: 'down' },
  ],
  drawOver: drawFx,
  onEnter: async () => { FX = []; },
  entities: [
    { type: 'logo', x: 1.15, y: 0.75, w: 2.7, h: 2.1, logo: 'toei', text: '撮影所のロゴ看板だ。今日もヒーローたちの撮影を見守っている。' },
    { type: 'sign', x: 1, y: 11, text: '撮影用のヒーロースーツ（レッド）。細かい傷がいっぱい…激しいアクションの勲章だ。' },
    { type: 'sign', x: 2, y: 11, text: 'ブルーのスーツ。ヘルメットの中は、思ったよりせまい…。' },
    { type: 'sign', x: 3, y: 11, text: '悪の怪人のスーツ。ツノが立派だ。夜中に見たら、ちょっとこわい。' },
    { type: 'sign', x: 4, y: 3, text: '発泡スチロールでできた岩だ。見た目はゴツゴツなのに、持ち上げると軽い！' },
    { type: 'sign', x: 6, y: 3, text: '爆破用の装置だ。「さわるな危険」と書いてある。' },
    { type: 'sign', x: 7, y: 2, text: '石切り場の背景画だ。遠くまで岩山が続いているように見える。' },
    { type: 'sign', x: 15, y: 2, text: '合成用のグリーンバック。ここで撮った映像に、宇宙や大都会を合成するんだ。' },

    {
      type: 'npc', id: 'toei_action', x: 8, y: 6, dir: 'down', look: LK.action, name: 'アクション監督',
      talk: async (g, npc) => {
        const o = who(npc);
        const i = await g.ask('アクション監督だ！ヒーローのアクションはまかせとけ！', ['アクション講座', 'スーツアクター', '話を聞く', 'やめておく'], o);
        if (i === 0) {
          await teach(g, npc, LESSON_ACTION, 'よし、まずは変身ポーズの基本からだ！\n指先までビシッと決めろよ！',
            (price) => [`アクション講座の受講料は${price}だ。`, 'オープンセットのエキストラでかせいでから、また来いよ！']);
        } else if (i === 1) {
          if (g.state.fame < 250) {
            await g.say(['スーツアクターは、顔が見えない分、体ぜんぶで芝居をする仕事だ。', '危ないアクションもあるから、★250以上の経験者にお願いしてるんだ。', 'それまでは、アクション講座で体を作っておけよ！'], o);
            return;
          }
          if (costumeOf(g) === 'hero') await g.say('おっ、もうスーツを着てるな！やる気満々じゃないか！', o);
          await g.say('よし、スーツを着て大立ち回りだ！\n変身ポーズはキレよく決めろよ！', o);
          const res = await g.job(JOBS.suit);
          if (res) await g.say(good(res) ? 'キレッキレだ！子どもたちが大喜びするぞ！' : 'おつかれ！スーツの中は暑かっただろ？', o);
        } else if (i === 2) {
          await g.say(['ヒーローは、立ち姿だけでかっこよくないとダメなんだ。', '指先まで気を抜かない！それがヒーローらしさってやつさ。', '火薬担当さんに頼めば、爆破テストを見せてもらえるぞ。'], o);
        }
      },
    },
    {
      type: 'npc', id: 'toei_suitactor', x: 15, y: 4, dir: 'down', look: LK.hero, name: 'ピクセリオン',
      talk: async (g, npc) => {
        const o = who(npc);
        await g.say('…………。', o);
        await g.emote('toei_suitactor', '!');
        g.sfx('whistle');
        await g.say(['（ピクセリオンは、無言で決めポーズをとった！）', '（…かと思ったら、小声で）\n「休憩中でもキャラを守るのが、プロなんです」'], o);
      },
    },
    {
      type: 'npc', id: 'toei_kaijin', x: 7, y: 4, dir: 'down', look: LK.kaijin, name: '怪人役',
      text: ['ガハハハ！我こそは悪の怪人…', '…あ、どうも。中身はふつうのおじさんです。', '悪役がしっかりこわいほど、ヒーローがかっこよく見えるんですよ。だから全力で悪者やってます！'],
    },
    {
      type: 'npc', id: 'toei_pyro_staff', x: 2, y: 5, dir: 'right', look: LK.pyro, name: '火薬担当',
      talk: async (g, npc) => {
        const o = who(npc);
        const i = await g.ask('火薬担当です。爆破シーンのテスト、見ていきます？', ['見る！', 'やめておく'], o);
        if (i !== 0) { await g.say('安全第一！爆破は、資格を持ったプロがきっちり管理してるんですよ。', o); return; }
        await explosionShow(g);
      },
    },
    {
      type: 'npc', id: 'toei_producer', x: 14, y: 10, dir: 'up', look: LK.producer, name: 'プロデューサー',
      talk: async (g, npc) => {
        const o = who(npc);
        const f = g.state.fame;
        if (f < 2000) {
          await g.say([
            'プロデューサーです。いま、劇場版ヒーロー映画の企画を進めていてね。',
            f < 1000 ? '主演はやっぱり、だれもが知ってるスターじゃないと。' : '君もかなりの売れっ子だけど…主演はスター級じゃないとね。',
            '★2000のスターになったら、ぜひ話をしよう！',
          ], o);
          return;
        }
        if (!g.flag('toei_movie_offer')) {
          g.setFlag('toei_movie_offer');
          await g.emote('toei_producer', '!');
          await g.say(['{name}さん！待ってましたよ！', '劇場版『光速ヒーロー ピクセリオン 銀河の決戦』…主演をお願いしたい！'], o);
        }
        const res = await g.job(JOBS.movie);
        if (res) await movieCelebration(g, res);
      },
    },
    {
      type: 'npc', id: 'toei_cameraman', x: 5, y: 8, dir: 'up', look: LK.cameraman, name: 'カメラマン',
      text: ['特撮は、カメラワークが命！', '下から見上げるように撮ると、ヒーローがぐっと大きく、かっこよく見えるんだ。'],
    },
    {
      type: 'npc', id: 'toei_kid', x: 3, y: 9, dir: 'right', look: LK.kid, name: '見学の子ども', wander: 1,
      talk: async (g, npc) => {
        const o = who(npc);
        if (costumeOf(g) === 'hero') {
          await g.emote('toei_kid', '!');
          await g.say('わあっ！ピクセリオンが2人いる！？\nあくしゅして！あくしゅ！', o);
          return;
        }
        await g.say('ねえねえ！ピクセリオンの変身ポーズ、知ってる？', o);
        await g.emote('toei_kid', '♪');
        await g.say(['こうやって、うでをぐるっと回して…「変身！」', 'ぼくも大きくなったら、スーツアクターになるんだ！'], o);
      },
    },
  ],
};

// ---------------------------------------------------------------- afureko
const afureko = {
  floor: 'floor_wood_dark',
  wall: 'navy',
  bg: '#101116',
  bgm: 'studio',
  entry: { x: 7, y: 10, dir: 'up' },
  tiles: [
    '################',
    '#============R=#',
    '#==============#',
    '#,k,m,,m,,m,,k,#',
    '#,,,,,,,,,,,,,,#',
    '#hh,,,,,,,,,,hh#',
    '#GGGGGGOGGGGGGG#',
    '#..............#',
    '#...XXXXXXX....#',
    '#..............#',
    '#SS.........PW.#',
    '#######MM#######',
  ],
  legend: {
    '=': 'toei_sound_wall', R: 'toei_sound_wall+toei_rec', ',': 'floor_carpet_gray', k: 'floor_carpet_gray+speaker',
    m: 'floor_carpet_gray+mic', h: 'floor_carpet_gray+chair', G: 'toei_glass', O: 'toei_booth_door',
    X: 'toei_console', S: 'sofa_blue', P: 'plant', W: 'water_server',
  },
  warps: [
    { x: 7, y: 11, room: 'gate', tx: 17, ty: 3, dir: 'down' },
    { x: 8, y: 11, room: 'gate', tx: 17, ty: 3, dir: 'down' },
  ],
  entities: [
    {
      // アニメを映す大きなモニター
      type: 'prop', x: 4, y: 1, w: 8, h: 2,
      text: ['モニターにアニメの映像が流れている。', '画面の下のタイムコードと、流れる白い線に合わせて、セリフを入れるんだ。'],
      draw(ctx, sx, sy, g) {
        const t = g.frame;
        F(ctx, sx - 1, sy, 130, 30, '#0c0d12');
        const x0 = sx + 2, y0 = sy + 1, w = 124, h = 19;
        F(ctx, x0, y0, w, 7, '#ff9a5a'); F(ctx, x0, y0 + 7, w, 6, '#ffb86a'); F(ctx, x0, y0 + 13, w, 6, '#ffd08a');
        pdisc(ctx, x0 + 22, y0 + 12, 5, '#fff2b0');
        for (let i = 0; i < w; i += 2) F(ctx, x0 + i, y0 + 14 + Math.round(Math.sin(i / 9) * 2), 2, 5 - Math.round(Math.sin(i / 9) * 2), '#7a4a8a');
        for (let i = 0; i < 6; i++) { const lx = (i * 23 + t * 3) % (w - 12); F(ctx, x0 + lx, y0 + 2 + (i * 7) % 12, 12, 1, 'rgba(255,255,255,0.6)'); }
        const cx = x0 + 88, cy = y0 + 1;
        F(ctx, cx - 1, cy + 3, 18, 15, '#ffe0c4');
        F(ctx, cx - 3, cy, 22, 6, '#3a6fd8'); for (let k = 0; k < 5; k++) F(ctx, cx - 3 + k * 5, cy - 2, 3, 3, '#3a6fd8');
        F(ctx, cx - 3, cy + 5, 3, 8, '#3a6fd8'); F(ctx, cx + 16, cy + 5, 3, 8, '#3a6fd8');
        F(ctx, cx + 3, cy + 9, 3, 4, '#20232a'); F(ctx, cx + 10, cy + 9, 3, 4, '#20232a');
        F(ctx, cx + 4, cy + 9, 1, 1, '#ffffff'); F(ctx, cx + 11, cy + 9, 1, 1, '#ffffff');
        const open = Math.floor(t / 8) % 3 !== 0;
        F(ctx, cx + 6, cy + 14, 4, open ? 2 : 1, '#b8404a');
        const sweep = (t * 1.5) % (w - 2);
        F(ctx, x0 + sweep, y0, 2, h, 'rgba(255,255,255,0.85)');
        F(ctx, x0, y0 + h, w, 10, '#0c0d12');
        const sec = Math.floor(t / 60) % 60, fr = Math.floor(t / 2) % 30;
        text(ctx, `00:12:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, x0 + 2, y0 + h, { size: 10, color: '#5ee07a', shadow: null });
        F(ctx, x0 + w - 22, y0 + h + 3, 4, 4, Math.floor(t / 20) % 2 ? '#ff2b3a' : '#5a1a1a');
        text(ctx, 'REC', x0 + w - 2, y0 + h, { size: 10, align: 'right', color: '#ff5d6c', shadow: null });
      },
    },
    { type: 'logo', x: 1.2, y: 0.8, w: 2.6, h: 2.05, logo: 'toei', text: '撮影所のロゴ看板だ。ここでアニメのキャラクターに声が吹きこまれる。' },
    { type: 'sign', x: 2, y: 3, text: '大きなスピーカー。映像の音や、相手役の声がここから流れる。' },

    {
      type: 'npc', id: 'toei_onkan', x: 12, y: 8, dir: 'left', look: LK.onkan, name: '音響監督',
      talk: async (g, npc) => {
        const o = who(npc);
        const has = g.flag('toei_voice_role');
        const i = await g.ask('音響監督です。アニメの声の演出を担当しています。', [has ? 'アフレコ出演' : '声優オーディション', '声の演技のコツ', 'やめておく'], o);
        if (i === 0) {
          if (!has) { await voiceAudition(g, npc); return; }
          await g.say('今日のアフレコ、よろしく！\n台本のむずかしい言葉、読み間違えないでね。', o);
          const res = await g.job(JOBS.voice);
          if (res) await g.say(good(res) ? 'バッチリ！キャラクターに命が吹き込まれたよ！' : 'おつかれさま！次はもっと役に入りこんでいこう。', o);
        } else if (i === 1) {
          await g.say(['アフレコは、絵の口の動きに合わせてセリフを入れるんだ。', 'マイクの前では、台本をめくる音も立てないようにね。', '発声練習なら、ブースのあいてるマイクを使っていいよ。'], o);
        }
      },
    },
    {
      type: 'npc', id: 'toei_mixer', x: 9, y: 9, dir: 'up', look: LK.mixer, name: 'ミキサーさん',
      text: ['このミキサー卓で、声の大きさや音質を調整してるんです。', 'ささやき声から叫び声まで、きれいに録るのが腕の見せどころ！', 'ブースとはガラスでしきられていて、こっちの音は向こうに聞こえないんですよ。'],
    },
    {
      type: 'npc', id: 'toei_seiyu', x: 7, y: 4, dir: 'up', look: LK.seiyu, name: 'ベテラン声優',
      talk: async (g, npc) => {
        const o = who(npc);
        await g.say('あら、こんにちは。ちょうどテストが終わったところよ。', o);
        await g.say(['わたしは、ひとりで何役も演じることがあるの。男の子の役も、おばあちゃんの役もね。', '声だけで、年れいも性格も伝える。それが声優のおもしろさよ。'], o);
        if (!g.flag('toei_voice_role') && g.state.fame >= 250) await g.say('新作アニメのオーディション、音響監督さんに声をかけてみたら？', o);
      },
    },
    {
      type: 'npc', id: 'toei_seiyu2', x: 13, y: 4, dir: 'left', look: LK.seiyu2, name: '若手声優',
      text: ['ぼく、ロボットアニメで主人公の声をやってるんです！', '叫ぶシーンが多くて、収録のあとはのどがカラカラ…。のどあめは必需品ですね。'],
    },
    {
      type: 'npc', id: 'toei_vmanager', x: 3, y: 10, dir: 'left', look: LK.manager, name: 'マネージャー',
      text: ['声優さんの付きそいで来ています。', '声のお仕事も、知名度が上がると、どんどんオファーが増えるんですよ。'],
    },
  ],
  events: [
    { x: 4, y: 3, on: 'action', run: (g) => micPractice(g) },
    { x: 10, y: 3, on: 'action', run: (g) => micPractice(g) },
  ],
};

async function micPractice(g) {
  if (g.flag('toei_mic_day') === g.state.day) {
    await g.say('「あめんぼ あかいな あいうえお」…\n今日はもう、たっぷり練習した。');
    return;
  }
  const i = await g.ask('マイクの前で発声練習をする？\n（体力 -5・1日1回）', ['練習する', 'やめておく']);
  if (i !== 0) return;
  if (!g.useStamina(5)) { await g.say('体力が足りない…。'); return; }
  g.setFlag('toei_mic_day', g.state.day);
  await g.fadeOut(8);
  g.sfx('talk');
  await g.wait(250);
  g.sfx('talk');
  await g.wait(250);
  await g.fadeIn(8);
  g.addSkill('talk', 1);
  await g.say('「あめんぼ あかいな あいうえお！」\n滑舌がちょっと良くなった気がする！');
}

// ---------------------------------------------------------------- costume
async function costumeFitting(g, npc) {
  const o = who(npc);
  if (costumeOf(g)) {
    const i = await g.ask('その衣装、似合ってるわよ〜！\n着がえる？', ['別の衣装にする', '脱ぐ', 'そのまま'], o);
    if (i === 1) {
      await g.fadeOut(8); removeCostume(g); await g.fadeIn(8);
      await g.say('はい、おつかれさま。\nまたいつでも着においで！', o);
      return;
    }
    if (i !== 0) return;
  } else {
    const i = await g.ask(['衣装さんです。衣装合わせ、してみる？', '撮影所の中なら、着たまま歩いていいわよ。'], ['着てみる', 'やめておく'], o);
    if (i !== 0) return;
  }
  const keys = Object.keys(COSTUMES);
  const j = await g.ask('どれにする？', [...keys.map((k) => COSTUMES[k].label), 'やめておく'], o);
  if (j < 0 || j >= keys.length) return;
  await g.fadeOut(10);
  wearCostume(g, keys[j]);
  await g.wait(250);
  await g.fadeIn(10);
  g.sfx('shutter');
  await g.say(COSTUMES[keys[j]].line, o);
  if (g.flag('toei_costume_day') !== g.state.day) {
    g.setFlag('toei_costume_day', g.state.day);
    g.state.buffs.engi = true;
    g.sfx('good');
    await g.say('衣装を着たら、役になりきれる気がしてきた！\n次の「演技」のミニゲームが少しやさしくなる。');
  }
}

const costume = {
  floor: 'floor_wood',
  wall: 'cream',
  bgm: 'office',
  entry: { x: 6, y: 9, dir: 'up' },
  tiles: [
    '##############',
    '#=mm=s=w=s=w=#',
    '#.TT.n..WW.YY#',
    '#............#',
    '#.KK.KK.r..H.#',
    '#............#',
    '#.KK.KK...BBB#',
    '#.........ttt#',
    '#k........ttt#',
    '#............#',
    '######M#######',
  ],
  legend: {
    m: 'wall_cream+mirror', s: 'wall_cream+shelf_wall', T: 'makeup', n: 'toei_sewing', W: 'toei_wig', Y: 'toei_yoroi',
    K: 'toei_kimono_rack', r: 'clothes_rack', H: 'toei_helmet_shelf', B: 'toei_byobu', t: 'floor_tatami', k: 'toei_katana',
  },
  warps: [{ x: 6, y: 10, room: 'gate', tx: 2, ty: 3, dir: 'down' }],
  entities: [
    { type: 'sign', x: 11, y: 2, text: '本物そっくりの鎧（よろい）。合戦シーンで使われるらしい。' },
    { type: 'sign', x: 12, y: 2, text: '赤い糸でつづられた鎧。かぶとの金の飾りがまぶしい。' },
    { type: 'sign', x: 9, y: 2, text: 'かつらがずらり。ちょんまげに、日本髪…役によって形がちがうんだ。' },
    { type: 'sign', x: 11, y: 4, text: 'ヒーローのヘルメットが並んでいる。予備も含めて、何個もあるんだ。' },
    { type: 'sign', x: 2, y: 4, text: 'きらびやかな着物がずらり。町人の着物から、お殿様の着物まで。' },
    { type: 'sign', x: 1, y: 8, text: '殺陣用の刀。竹光（たけみつ）だから、見た目よりずっと軽い。' },
    { type: 'sign', x: 11, y: 6, text: '金色の屏風。この奥のたたみで、衣装合わせをするみたいだ。' },
    { type: 'sign', x: 2, y: 2, text: 'メイク台だ。白ぬり用のおしろいや、つけヒゲがならんでいる。' },

    { type: 'npc', id: 'toei_ishou', x: 9, y: 7, dir: 'left', look: LK.ishou, name: '衣装さん', talk: costumeFitting },
    {
      type: 'npc', id: 'toei_katsura', x: 8, y: 3, dir: 'up', look: LK.katsura, name: 'かつら師',
      text: ['わしはかつら師。時代劇のかつらを、役者さんの頭に合わせて作っとる。', 'ちょんまげのかつらも、ひとりひとり形がちがうんじゃ。', 'ぴったり合うと、表情までよう見える。役者の顔を生かすのが、わしの仕事じゃ。'],
    },
    {
      type: 'npc', id: 'toei_ohariko', x: 5, y: 3, dir: 'up', look: LK.ohariko, name: 'お針子さん',
      text: ['ほつれた衣装を、ちくちく直してるところです。', '殺陣のシーンのあとは、衣装がボロボロになることも…。', 'でも、それだけ熱い芝居だったってことですよね！'],
    },
  ],
};

// =====================================================================
registerPlace({
  id: 'toei',
  name: '東映 撮影所',
  kind: 'building',
  bgm: 'studio',
  start: { room: 'gate', x: 9, y: 12, dir: 'up' },
  rooms: { gate, openset, tokusatsu, afureko, costume },
});
