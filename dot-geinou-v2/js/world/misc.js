// 銭湯「ドットの湯」（東京）／ドットホテル なんば／たこ焼き屋（なんば）
//
// sento    : 番台のおかみさん → 男湯・女湯ののれん → 浴室（富士山のペンキ絵・湯船・カラン・脱衣所）
//            お風呂 ¥500（1日1回・体力+40・のんびり演出）、コーヒー牛乳などの販売、マッサージチェア、
//            銭湯寄席（所属 or ★30）、PRポスター撮影（★250）、サイン色紙（★1000・以後お風呂無料）、
//            銭湯PR大使（★2000）
// hotel    : フロントで1泊 ¥3,000 → ベルスタッフの案内で客室へ → ベッドで g.sleep()。
//            宴会場のお仕事：宴会の余興（所属 or ★30）・披露宴の司会（★250）・ディナーショー（★1000）。
//            ★2000 で宿泊ご招待。ロビーのテレビで大阪の情報、コンシェルジュがなんばを案内。
// takoyaki : 大将の店（g.shop）、たこ焼き焼きのバイト（誰でも）、商店街の祭りの司会（所属 or ★30）、
//            グルメ番組の食レポ（★250）、新メニュー「スター焼き」誕生（★1000）、商店街のCM（★2000）
//
// ids / flags are prefixed with sento_ / hotel_ / takoyaki_. Every character is fictional.

import { registerPlace } from '../engine/map.js';
import { LOOKS, drawFace } from '../engine/sprites.js';
import { defineTile, R, P, speckle, disc, shadowEllipse } from '../engine/tiles.js';
import { registerItem, ITEMS } from '../engine/state.js';
import { ACTIVITY } from '../engine/life.js';
import { registerSong } from '../engine/audio.js';
import { text } from '../engine/draw.js';
import { TILE, DIRS, makeCanvas, shade } from '../engine/util.js';

// ====================================================================== shared helpers
const today = (g, k) => g.flag(k) === g.state.day;
const who = (n) => ({ name: n.name, look: n.look });
const say = (g, n, t) => g.say(t, who(n));
const ask = (g, n, t, choices) => g.ask(t, choices, who(n));
const tier1 = (g) => !!g.state.agency || g.state.fame >= 30;
const TIER1 = { anyOf: [{ agency: true }, { fame: 30 }] }; // same rule as tier1(), for g.job
const npc = (id, x, y, dir, look, name, extra = {}) => ({ type: 'npc', id, x, y, dir, look, name, ...extra });

// For on-enter cutscenes: waits a moment, then tells whether this is still the same
// room load and the cutscene has not been shown yet (sets the flag when it may play).
async function firstEnter(g, flag) {
  if (g.flag(flag)) return false;
  const ents = g.map.entities;
  await g.wait(200);
  if (g.map.entities !== ents || g.flag(flag)) return false;
  g.setFlag(flag);
  return true;
}

// Menu helper: items = [{ label, run }], the last item is the cancel entry (run: null).
async function menu(g, n, prompt, items) {
  const i = await g.ask(prompt, items.map((it) => it.label), who(n));
  const it = items[i];
  if (it && it.run) await it.run();
}

// Shortest walkable path for the player (cutscenes), avoiding NPCs, props and warps.
function findPath(g, sx, sy, tx, ty) {
  const m = g.map;
  const key = (x, y) => x + ',' + y;
  const prev = new Map([[key(sx, sy), null]]);
  const q = [[sx, sy]];
  while (q.length) {
    const [cx, cy] = q.shift();
    if (cx === tx && cy === ty) break;
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const nx = cx + dx, ny = cy + dy;
      const k = key(nx, ny);
      if (prev.has(k) || m.blocked(nx, ny, null) || m.warpAt(nx, ny)) continue;
      prev.set(k, [cx, cy, d]);
      q.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  const steps = [];
  let cur = key(tx, ty);
  while (prev.get(cur)) { const [px, py, d] = prev.get(cur); steps.unshift(d); cur = key(px, py); }
  return steps;
}
async function walkPlayerTo(g, x, y, dir) {
  const p = g.map.player;
  const steps = findPath(g, p.x, p.y, x, y);
  if (steps === null) g.placePlayer(x, y);
  else if (steps.length) await g.movePlayer(steps);
  if (dir) g.facePlayer(dir);
}

// ====================================================================== items & music
registerItem('sento_milk', { name: 'コーヒー牛乳', price: 150, desc: '体力が10回復する。風呂上がりの定番！', heal: 10 });
registerItem('sento_fruitmilk', { name: 'フルーツ牛乳', price: 150, desc: '体力が10回復する。甘くてやさしい味。', heal: 10 });
registerItem('takoyaki_negi', { name: 'ねぎたこ', price: 550, desc: '体力が45回復する。ねぎたっぷりで、さっぱり！', heal: 45 });
registerItem('takoyaki_ramune', { name: 'ラムネ', price: 150, desc: '体力が10回復する。シュワッと爽快！', heal: 10 });
registerItem('takoyaki_star', { name: 'スター焼き', price: 800, desc: '体力が60回復する。金ごまキラキラの特製たこ焼き！', heal: 60 });

// A slow, steamy pentatonic loop for the bathhouse.
registerSong('sento_yu', {
  bpm: 84, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.09, notes: 'A4 - C5 - D5 - C5 A4 | G4 - - - E4 - G4 - | A4 - C5 - D5 - E5 D5 | C5 - - - - - . . | E5 - D5 - C5 - A4 C5 | D5 - - - A4 - G4 - | E4 - G4 - A4 - C5 A4 | A4 - - - - - . .' },
    { wave: 'triangle', vol: 0.065, notes: 'A2 . E3 . A3 . E3 . | C3 . G3 . C4 . G3 . | F2 . C3 . F3 . C3 . | A2 . E3 . A3 . E3 . | C3 . G3 . C4 . G3 . | D3 . A3 . D4 . A3 . | E2 . B2 . E3 . B2 . | A2 . E3 . A3 . . .' },
    { wave: 'drum', vol: 0.035, notes: 'h . . . . . . . | . . . . h . . .' },
  ],
});

// ====================================================================== 銭湯 tiles
const SG = '#b7c9d8'; // grout
const ST = '#eef4f8'; // white tile
const SB = '#5b8fd0'; // blue tile
const SBD = '#3c6aa8';
const SW = '#72c2ea'; // bath water
const SWD = '#58aedc';
const SWL = '#c4ecfb';
const WD = '#7a5028', WM = '#a8743f', WL = '#c99660'; // wood

defineTile('sento_floor', {
  draw(c) {
    R(c, 0, 0, 16, 16, SG);
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 4) R(c, x, y, 3, 3, (x * 3 + y * 5) % 16 === 4 ? '#d3e6f4' : ST);
  },
});
defineTile('sento_goza', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#d9c28c');
    for (let y = 1; y < 16; y += 2) R(c, 0, y, 16, 1, '#ccb37a');
    R(c, 0, 0, 1, 16, '#b0924f');
    speckle(c, r, ['#e6d4a4'], 6);
  },
});
defineTile('sento_tub', {
  solid: true, frames: 2, speed: 40,
  draw(c, r, f) {
    R(c, 0, 0, 16, 16, SW);
    R(c, 0, 0, 16, 3, ST); R(c, 0, 3, 16, 1, SG);
    for (let x = 0; x < 16; x += 4) R(c, x, 0, 1, 3, SG);
    R(c, 0, 4, 16, 1, SWD);
    speckle(c, r, [SWD], 6, 0, 5, 16, 11);
    const o = f * 3;
    for (const [x, y] of [[1, 7], [8, 10], [4, 13], [11, 6]]) R(c, (x + o) % 13, y, 3, 1, SWL);
  },
});
defineTile('sento_rim', {
  solid: true, talkThrough: true, frames: 2, speed: 40,
  draw(c, r, f) {
    R(c, 0, 0, 16, 6, SW);
    R(c, (2 + f * 5) % 12, 2, 4, 1, SWL);
    R(c, 0, 6, 16, 3, ST); R(c, 0, 6, 16, 1, '#ffffff'); R(c, 0, 8, 16, 1, SG);
    R(c, 0, 9, 16, 7, SB);
    for (let x = 0; x < 16; x += 4) R(c, x, 9, 1, 7, SBD);
    R(c, 0, 12, 16, 1, SBD);
    R(c, 0, 15, 16, 1, '#2a4e84');
  },
});
for (const side of ['l', 'r']) {
  defineTile('sento_partition_' + side, {
    solid: true,
    draw(c) {
      R(c, 0, 0, 16, 16, '#dde7ee');
      for (let y = 3; y < 16; y += 4) R(c, 0, y, 16, 1, '#c8d6e1');
      for (let y = 0; y < 16; y += 4) R(c, ((y / 4) % 2) ? 4 : 11, y, 1, 3, '#c8d6e1');
      R(c, side === 'l' ? 0 : 15, 0, 1, 16, '#8fa5b8');
      R(c, side === 'l' ? 1 : 14, 0, 1, 16, '#f6fafc');
    },
  });
}
defineTile('sento_karan', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 0, 10, 8, '#8e939c'); R(c, 4, 1, 8, 6, '#cfe9f6');
    R(c, 5, 2, 3, 1, '#ffffff'); R(c, 5, 3, 1, 2, '#ffffff');
    R(c, 1, 8, 14, 2, '#c3c8d0'); R(c, 1, 8, 14, 1, '#e8eaee');
    R(c, 3, 7, 2, 2, '#d64545'); R(c, 11, 7, 2, 2, '#3f74d6'); R(c, 7, 8, 2, 3, '#dfe3ea'); P(c, 8, 11, SWL);
    R(c, 0, 10, 16, 6, SB); R(c, 0, 10, 16, 1, '#ffffff');
    for (let x = 0; x < 16; x += 4) R(c, x, 11, 1, 5, SBD);
    R(c, 0, 15, 16, 1, '#2a4e84');
  },
});
defineTile('sento_oke', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 3, 8, 10, 3, '#f4f6f8'); R(c, 3, 8, 10, 1, '#ffffff'); R(c, 3, 10, 10, 1, '#d5d9e0');
    R(c, 4, 11, 2, 3, '#d5d9e0'); R(c, 10, 11, 2, 3, '#d5d9e0');
    R(c, 5, 3, 6, 5, '#f2c230'); R(c, 4, 2, 8, 2, '#ffe06a'); R(c, 5, 3, 6, 1, '#c99a1a'); R(c, 6, 5, 4, 1, '#ffe06a');
  },
});
defineTile('sento_glass', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, WD);
    R(c, 1, 1, 6, 11, '#d8e7ee'); R(c, 9, 1, 6, 11, '#d8e7ee');
    R(c, 1, 6, 6, 1, WM); R(c, 9, 6, 6, 1, WM);
    R(c, 2, 2, 1, 3, '#f6fcff'); R(c, 10, 2, 1, 3, '#f6fcff');
    R(c, 0, 12, 16, 4, WM); R(c, 0, 12, 16, 1, WL); R(c, 0, 15, 16, 1, '#5a3a20');
  },
});
defineTile('sento_glassdoor', {
  draw(c) {
    R(c, 0, 0, 16, 16, SG);
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 4) R(c, x, y, 3, 3, ST);
    R(c, 0, 0, 2, 16, WD); R(c, 14, 0, 2, 16, WD); R(c, 1, 0, 1, 16, WM);
    R(c, 2, 14, 12, 2, '#a3a8b2'); R(c, 2, 14, 12, 1, '#c3c8d0');
  },
});
defineTile('sento_locker', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#5a3a20');
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const x = 1 + col * 7, y = 1 + row * 5;
        R(c, x, y, 7, 4, '#b07a46'); R(c, x, y, 7, 1, '#c9955a');
        R(c, x + 1, y + 1, 3, 2, '#f2ecdc'); P(c, x + 2, y + 1, '#20232a');
        P(c, x + 5, y + 2, '#e8c43a');
      }
    }
    R(c, 0, 15, 16, 1, '#3a2512');
  },
});
defineTile('sento_basket', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 2, 7, 12, 7, '#c9a46a');
    for (let x = 3; x < 14; x += 2) R(c, x, 8, 1, 6, '#a8844a');
    R(c, 2, 7, 12, 1, '#e2c48e');
    R(c, 4, 4, 8, 4, '#ffffff'); R(c, 4, 7, 8, 1, '#d5d9e0'); R(c, 4, 5, 8, 1, SB);
  },
});
defineTile('sento_scale', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 5, 1);
    R(c, 3, 11, 10, 4, '#dfe3ea'); R(c, 3, 11, 10, 1, '#ffffff'); R(c, 3, 14, 10, 1, '#9aa0aa');
    R(c, 7, 6, 2, 5, '#c3c8d0');
    disc(c, 8, 4, 4, '#3b3f48'); disc(c, 8, 4, 3, '#fbfbf6'); R(c, 8, 2, 1, 3, '#d62f2f'); P(c, 8, 4, '#20232a');
  },
});
defineTile('sento_fan', {
  solid: true, obj: true, frames: 2, speed: 6,
  draw(c, r, f) {
    shadowEllipse(c, 8, 15, 4, 1);
    R(c, 7, 9, 2, 6, '#dfe3ea'); R(c, 5, 14, 6, 1, '#b8bec8');
    disc(c, 8, 5, 5, '#9aa0aa'); disc(c, 8, 5, 4, '#e3f3fb');
    if (f) R(c, 4, 4, 9, 3, '#5fb8e8'); else R(c, 7, 1, 3, 9, '#5fb8e8');
    disc(c, 8, 5, 1, '#3f74d6');
  },
});
function noren(c, col, slitAtLeft) {
  R(c, 0, 0, 16, 16, '#2a2420');
  R(c, 0, 13, 16, 3, '#8a6a48'); R(c, 0, 13, 16, 1, '#a8845a');
  R(c, 0, 0, 16, 2, WD); R(c, 0, 0, 16, 1, WL);
  R(c, 0, 2, 16, 10, col); R(c, 0, 2, 16, 1, shade(col, 0.25));
  for (let x = 3; x < 16; x += 5) R(c, x, 3, 1, 8, shade(col, -0.12));
  R(c, 0, 11, 16, 1, shade(col, -0.35));
  R(c, slitAtLeft ? 0 : 15, 3, 1, 9, '#2a2420');
}
defineTile('sento_noren_ml', { draw(c) { noren(c, '#24407a', false); } });
defineTile('sento_noren_mr', { draw(c) { noren(c, '#24407a', true); } });
defineTile('sento_noren_fl', { draw(c) { noren(c, '#b83a4a', false); } });
defineTile('sento_noren_fr', { draw(c) { noren(c, '#b83a4a', true); } });
defineTile('sento_bandai_floor', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#c9c27a');
    for (let y = 1; y < 16; y += 2) R(c, 0, y, 16, 1, '#bdb56c');
    R(c, 0, 0, 16, 1, '#3d5a2a'); R(c, 0, 14, 16, 2, WD);
  },
});
defineTile('sento_bandai_side', {
  solid: true, obj: true,
  draw(c) {
    R(c, 4, 0, 8, 16, WM); R(c, 4, 0, 8, 2, WL); R(c, 4, 0, 1, 16, WL); R(c, 11, 0, 1, 16, WD);
    for (let y = 5; y < 16; y += 4) R(c, 5, y, 6, 1, shade(WM, -0.15));
    R(c, 4, 15, 8, 1, '#4a2e18');
  },
});
defineTile('sento_bandai_goods', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 4, 14, 11, WD); R(c, 1, 4, 14, 1, WL);
    R(c, 2, 5, 12, 4, '#3a2512'); R(c, 2, 10, 12, 4, '#3a2512');
    R(c, 3, 6, 3, 3, '#ffffff'); R(c, 7, 5, 2, 4, '#ff8fb1'); R(c, 10, 5, 2, 4, '#7ab8f0');
    R(c, 3, 11, 4, 3, '#f2f2f2'); R(c, 8, 11, 5, 3, '#5fb36a'); R(c, 8, 12, 5, 1, '#ffffff');
  },
});
defineTile('sento_bandai_front', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 0, 0, 16, 4, WL); R(c, 0, 0, 16, 1, '#e0b47c'); R(c, 0, 3, 16, 1, WM);
    R(c, 5, 1, 6, 2, '#c3c8d0'); R(c, 6, 1, 4, 1, '#e8eaee');
    R(c, 0, 4, 16, 12, WM);
    for (let x = 2; x < 16; x += 5) R(c, x, 5, 1, 10, shade(WM, -0.18));
    R(c, 0, 15, 16, 1, '#4a2e18');
  },
});
defineTile('sento_milkcase', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 0, 14, 16, '#dfe3ea'); R(c, 1, 0, 14, 1, '#ffffff'); R(c, 2, 1, 12, 10, '#c8ecfb');
    const cols = ['#fbfbf6', '#a0683a', '#ffb347'];
    for (let row = 0; row < 2; row++) {
      R(c, 2, 5 + row * 5, 12, 1, '#9aa0aa');
      for (let i = 0; i < 4; i++) {
        const x = 3 + i * 3, y = 1 + row * 5;
        R(c, x, y + 1, 2, 3, cols[(i + row) % 3]); R(c, x, y, 2, 1, '#e8e4d0');
      }
    }
    R(c, 1, 11, 14, 5, '#b8bec8'); R(c, 3, 12, 10, 1, '#8e939c'); R(c, 2, 15, 12, 1, '#7d828c');
  },
});
defineTile('sento_massage', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 7, 1);
    R(c, 3, 0, 10, 10, '#4a2e1e'); R(c, 4, 1, 8, 8, '#6e4630'); R(c, 5, 2, 6, 2, '#8a5a3e');
    R(c, 1, 6, 3, 8, '#3a2416'); R(c, 12, 6, 3, 8, '#3a2416');
    R(c, 3, 9, 10, 4, '#7a5038'); R(c, 3, 9, 10, 1, '#946448');
    R(c, 4, 13, 8, 2, '#2a1a10'); P(c, 13, 7, '#5ee07a');
  },
});
defineTile('sento_getabako', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#5a3a20');
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 1 + col * 5, y = 1 + row * 4;
        R(c, x, y, 4, 3, '#c48a52'); R(c, x + 1, y + 1, 2, 1, '#f2e2c0');
      }
    }
  },
});
defineTile('sento_board', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 2, 14, 10, '#7a4e2a'); R(c, 2, 3, 12, 8, '#c9955a');
    R(c, 3, 4, 4, 6, '#ffffff'); R(c, 4, 5, 2, 1, '#d62f2f'); R(c, 4, 7, 2, 1, '#20232a'); R(c, 4, 8, 2, 1, '#20232a');
    R(c, 8, 4, 5, 3, '#ffe36e'); R(c, 8, 8, 5, 2, '#ffb3c8'); P(c, 10, 4, '#d62f2f'); P(c, 5, 4, '#2f6fd0');
  },
});

// ---- the Mt. Fuji mural (ペンキ絵): one painting split into 18x3 wall tiles
const MURAL_W = 18, MURAL_H = 3;
let muralCv = null;
function muralCanvas() {
  if (muralCv) return muralCv;
  const MW = MURAL_W * TILE, MH = MURAL_H * TILE;
  const [cv, c] = makeCanvas(MW, MH);
  // sky
  const sky = ['#62aee9', '#72b8ee', '#84c4f1', '#98cef4', '#acd8f6', '#c0e2f8', '#d4ecfa', '#e4f3fc'];
  sky.forEach((col, i) => R(c, 0, i * 5, MW, 5, col));
  // clouds
  const cloud = (x, y, w) => {
    R(c, x, y, w, 3, '#ffffff'); R(c, x + 3, y - 2, w - 8, 2, '#ffffff'); R(c, x + 6, y - 3, w - 16, 1, '#ffffff');
    R(c, x + 2, y + 3, w - 4, 1, '#d8ecf8');
  };
  cloud(10, 9, 30); cloud(52, 15, 22); cloud(214, 8, 34); cloud(252, 17, 24);
  // far ridges
  for (let x = 0; x < MW; x++) {
    const h = 7 + Math.round(4 * Math.sin(x / 23) + 3 * Math.sin(x / 9 + 1));
    R(c, x, 37 - h, 1, h, '#86a3cc');
  }
  // Mt. Fuji (peak right above the partition between the two baths)
  const cx = MW / 2, top = 3, base = 37;
  const half = (y) => Math.round(3 + Math.pow((y - top) / (base - top), 1.45) * 96);
  for (let y = top; y < base; y++) {
    const hw = half(y);
    R(c, cx - hw, y, hw * 2, 1, '#3f5a9e');
    R(c, cx - hw, y, Math.round(hw * 0.92), 1, '#5470b2');
  }
  for (let y = top; y < top + 14; y++) {
    const hw = half(y);
    for (let x = cx - hw; x < cx + hw; x++) {
      const edge = top + 8 + Math.round(4 * Math.abs(Math.sin((x - cx) / 6)));
      if (y <= edge) P(c, x, y, x < cx ? '#ffffff' : '#dfe8f5');
    }
  }
  // shores with pines
  for (let x = 0; x < 64; x++) { const h = Math.round(9 - x / 8); if (h > 0) R(c, x, 37 - h, 1, h + 1, '#4f8a4a'); }
  for (let x = MW - 64; x < MW; x++) { const h = Math.round(9 - (MW - x) / 8); if (h > 0) R(c, x, 37 - h, 1, h + 1, '#4f8a4a'); }
  const pine = (x, y) => {
    R(c, x, y - 9, 2, 10, '#5a3a20');
    R(c, x - 6, y - 6, 14, 3, '#2a5a30'); R(c, x - 6, y - 6, 14, 1, '#4a8a4a');
    R(c, x - 4, y - 10, 10, 3, '#2a5a30'); R(c, x - 4, y - 10, 10, 1, '#4a8a4a');
    R(c, x - 2, y - 13, 6, 2, '#2a5a30');
  };
  pine(10, 33); pine(30, 34); pine(MW - 14, 33); pine(MW - 34, 34);
  // lake with Fuji's reflection and a little sailboat
  R(c, 0, 37, MW, 7, '#4f8fd6');
  for (let y = 37; y < 44; y++) { const hw = 64 - (y - 37) * 8; if (hw > 0) R(c, cx - hw, y, hw * 2, 1, '#6aa2e0'); }
  for (let i = 0; i < 9; i++) R(c, (i * 37 + 11) % (MW - 8), 38 + (i % 3) * 2, 6, 1, '#b2dbf7');
  R(c, 82, 40, 9, 2, '#8a5a33');
  for (let i = 0; i < 6; i++) R(c, 86 - Math.floor(i / 2), 34 + i, 1 + Math.floor(i / 2), 1, '#ffffff');
  R(c, 86, 33, 1, 7, '#5a3a20');
  // tiled wainscot under the painting
  R(c, 0, 44, MW, 4, '#e6eef4'); R(c, 0, 44, MW, 1, '#9cc8e8');
  for (let x = 0; x < MW; x += 4) R(c, x, 45, 1, 3, SG);
  muralCv = cv;
  return cv;
}
const MURAL_LEGEND = {};
const muralRow = (ty) => {
  let s = '';
  for (let tx = 0; tx < MURAL_W; tx++) {
    const ch = String.fromCharCode(0x4e00 + ty * MURAL_W + tx);
    const id = `sento_fuji_${tx}_${ty}`;
    if (!MURAL_LEGEND[ch]) {
      defineTile(id, { solid: true, draw(c) { c.drawImage(muralCanvas(), -tx * TILE, -ty * TILE); } });
      MURAL_LEGEND[ch] = id;
    }
    s += ch;
  }
  return s;
};

// ====================================================================== 銭湯 people
const OKAMI = { name: 'おかみさん', look: { hair: 'bob', hairColor: 'silver', skin: 'fair', top: '#f2f2f2', bottom: '#3a58a8', skirt: true } };
const KID = { name: 'こども', look: { ...LOOKS.kid, top: '#ffffff', bottom: '#2f6fd0' } };
const GEININ = { name: '売れない芸人', look: { ...LOOKS.comedian, top: '#8a6a4a', bottom: '#3b3f48', hairColor: 'black' } };
const GOINKYO = { name: '湯船のご隠居', look: { hair: 'bald', hairColor: 'white', skin: 'tan', top: '#8a6a4a', bottom: '#5a4a3a', glasses: false } };
const OBAACHAN = { name: '湯船のおばあちゃん', look: { hair: 'bob', hairColor: 'silver', skin: 'fair', top: '#9273bd', bottom: '#5a4a6a' } };
const OJISAN = { name: '常連のおじさん', look: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#3a58a8', bottom: '#3a58a8' } };
const ONEESAN = { name: '劇団員のお姉さん', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#c25070', bottom: '#5a4a6a', skirt: true } };
const WAKA = { name: 'おかみさんの息子', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#ffffff', bottom: '#3a58a8' } };

let bathing = null; // { x } while the player soaks in the tub (cutscene)

function drawBather(ctx, sx, sy, look, frame, towel, seed) {
  const bob = Math.sin((frame + seed * 47) / 30) > 0.55 ? 1 : 0;
  const y = sy - 2 + bob;
  drawFace(ctx, look, sx, y, 1);
  R(ctx, sx + 4, y - 1, 8, 2, towel); R(ctx, sx + 4, y + 1, 8, 1, shade(towel, -0.18));
  R(ctx, sx + 1, sy + 9, 14, 2, SW);
  R(ctx, sx + 2, sy + 9, 3, 1, SWL); R(ctx, sx + 11, sy + 10, 3, 1, SWL);
}
function bather(id, x, y, who, towel, talk) {
  return {
    type: 'prop', id, x, y, w: 1, h: 1, px: x * TILE, py: y * TILE, name: who.name, look: who.look, talk,
    draw(ctx, sx, sy, g) { drawBather(ctx, sx, sy, who.look, g.frame, towel, x); },
  };
}

// ====================================================================== 銭湯 content
const BATH_PRICE = 500;
const bathPrice = (g) => (g.flag('sento_vip') ? 0 : BATH_PRICE);
// A soak in the big tub (once a day): stamina, a full wash and a calmer mind.
// A bit less stress relief than going with a friend (the 銭湯 hangout in machi.js).
const BATH_HEAL = 40;
const BATH_STRESS = 12;
const BATH_EFFECT = `体力 +${BATH_HEAL}・身だしなみ 全回復・ストレス -${BATH_STRESS}`;
const MASSAGE_STRESS = 4;

const YOSE_LINES = [
  { boke: 'いやあ、今日もいいお湯だったねえ。', punch: false },
  { boke: '気持ちよくて、湯船に3時間つかってたよ。', punch: true, tsukkomi: 'のぼせちゃうよ！' },
  { boke: '頭はね、しっかり洗う主義なんだ。', punch: false },
  { boke: 'シャンプーと間違えて、牛乳で洗っちゃった。', punch: true, tsukkomi: 'それは飲み物！' },
  { boke: '富士山の絵に向かって「おーい」と叫んだらね…', punch: false },
  { boke: 'ちゃんと山びこが返ってきたんだよ。', punch: true, tsukkomi: '絵だから！' },
  { boke: '風呂上がりには、やっぱりコーヒー牛乳。', punch: false },
  { boke: '腰に手を当てて、一気に10本！', punch: true, tsukkomi: 'お腹こわすよ！' },
];
const TAISHI_SCENES = [
  { prompt: '司会「銭湯の魅力といえば？」', answers: [
    { text: '大きなお風呂と富士山！', score: 100 },
    { text: '…家のお風呂かな', score: 0 },
    { text: 'コーヒー牛乳です', score: 60 },
  ] },
  { prompt: 'ご隠居「熱いお湯のコツは？」', answers: [
    { text: 'かけ湯で体をならす', score: 100 },
    { text: '気合いです！', score: 50 },
    { text: '水でうめちゃう', score: 10 },
  ] },
  { prompt: 'こども「おすすめの飲み方は？」', answers: [
    { text: 'ストローでちびちび', score: 40 },
    { text: '腰に手を当てて一気！', score: 100 },
    { text: '湯船の中で飲む', score: 0 },
  ] },
  { prompt: '司会「最後に、ひとこと！」', answers: [
    { text: 'のぼせました…', score: 30 },
    { text: '…以上です', score: 10 },
    { text: 'みんなで銭湯へ行こう！', score: 100 },
  ] },
];
const SENTO_JOBS = {
  yose: {
    id: 'sento_yose', title: '銭湯寄席', client: OKAMI.name, clientLook: OKAMI.look,
    desc: '高座で、常連さんを笑わせよう！', stamina: 20,
    minigame: 'tsukkomi', opts: { difficulty: 2, lines: YOSE_LINES, rounds: 8, partner: 'ご隠居', partnerLook: GOINKYO.look },
    pay: 3500, fame: 12, skill: 'warai', gain: 2, requires: TIER1,
  },
  poster: {
    id: 'sento_poster', title: '銭湯PRポスター撮影', client: OKAMI.name, clientLook: OKAMI.look,
    desc: '銭湯組合のポスターのモデルに！', stamina: 25,
    minigame: 'command', opts: { theme: 'acting', difficulty: 3 },
    pay: 10000, fame: 40, skill: 'engi', gain: 3, requires: { fame: 250 },
  },
  taishi: {
    id: 'sento_taishi', title: '銭湯PR大使 就任イベント', client: OKAMI.name, clientLook: OKAMI.look,
    desc: '銭湯の魅力をトークで伝えよう！', stamina: 30,
    minigame: 'talk', opts: { difficulty: 4, topic: '銭湯トークショー', scenes: TAISHI_SCENES },
    pay: 55000, fame: 170, skill: 'talk', gain: 4, requires: { fame: 2000 },
  },
};

// Returns true when the player may go in / bathe today.
async function payBath(g) {
  if (today(g, 'sento_bath_day')) {
    await say(g, OKAMI, ['今日はもう入ったろう？', 'のぼせちゃうから、また明日おいで！\n…あ、浴室でおしゃべりするだけなら、どうぞ。']);
    return true;
  }
  if (today(g, 'sento_paid_day')) { await say(g, OKAMI, 'お代はもうもらってるよ。\nゆっくり温まっておいで！'); return true; }
  const price = bathPrice(g);
  if (price && !g.spend(price)) {
    await say(g, OKAMI, ['あらら、お金が足りないみたいだね…。', 'お仕事でかせいでから、またおいで！']);
    return false;
  }
  g.sfx('coin');
  g.setFlag('sento_paid_day', g.state.day);
  if (price) await say(g, OKAMI, ['はい、ちょうど！手ぬぐいはサービスだよ。', '左ののれんが男湯、右が女湯。\n湯船につかって、ゆっくり温まっておいで！']);
  else await say(g, OKAMI, ['スターさんは顔パスだよ！', '湯船につかって、ゆっくり温まっておいで！']);
  return true;
}

async function norenCheck(g) {
  if (today(g, 'sento_paid_day') || today(g, 'sento_bath_day')) return true;
  if (g.npc('sento_okami')) await g.emote('sento_okami', '!', 30);
  const label = bathPrice(g) ? '払う（¥500）' : 'おねがいします';
  const i = await g.ask('ちょいと、お客さん！\nお風呂は番台でお代をもらうよ。', [label, 'やめておく'], who(OKAMI));
  if (i !== 0) return false;
  return payBath(g);
}

async function gulpMilk(g) {
  const id = g.hasItem('sento_milk') ? 'sento_milk' : 'sento_fruitmilk';
  g.takeItem(id);
  g.setFlag('sento_gulp_day', g.state.day);
  g.facePlayer('down');
  await g.say('（瓶のふたを開けて、腰に手を当てて…）');
  await g.emote('player', '!', 30);
  g.sfx('drum');
  await g.say('ゴクッ、ゴクッ、ゴクッ……');
  g.heal(10);
  g.sfx('good');
  await g.emote('player', '♥');
  await g.say(['ぷはーーっ！', `風呂上がりの${ITEMS[id].name}、最高！\n体力が10回復した。`]);
  if (g.npc('sento_kid')) {
    await g.emote('sento_kid', '!');
    await say(g, KID, 'わあっ、いい飲みっぷり！\nそれが銭湯の作法だよね！');
  }
}

async function milkShop(g) {
  const bought = await g.shop(['sento_milk', 'sento_fruitmilk'], { title: 'ドットの湯 番台', greeting: '冷えてるよ〜！' });
  if (!bought) return;
  if (today(g, 'sento_bath_day') && !today(g, 'sento_gulp_day') && (g.hasItem('sento_milk') || g.hasItem('sento_fruitmilk'))) {
    const j = await ask(g, OKAMI, '風呂上がりだね？\nせっかくだから、ここでぐいっといきな！', ['飲む！', 'あとで飲む']);
    if (j === 0) { await gulpMilk(g); return; }
  }
  await say(g, OKAMI, 'まいどあり！\n風呂上がりに飲むのが、いちばんだよ。');
}

async function yoseJob(g) {
  const res = await g.job(SENTO_JOBS.yose);
  if (!res) return;
  if ('SAB'.includes(res.rank)) {
    g.sfx('applause');
    if (g.npc('sento_kid')) g.emote('sento_kid', 'w');
    if (g.npc('sento_geinin')) g.emote('sento_geinin', '!');
    await say(g, OKAMI, ['いやあ、みんな大笑いだったよ！', 'ご隠居も「いいツッコミだ」って喜んでたよ。\nまた頼むね！']);
  } else {
    await say(g, OKAMI, 'ご隠居のボケが自由すぎたかね…。\n次は、もっと笑わせておくれ！');
  }
}

async function posterJob(g) {
  const first = !g.flag('sento_poster_done');
  const res = await g.job(SENTO_JOBS.poster);
  if (!res) return;
  if (first) {
    g.setFlag('sento_poster_done');
    await g.fadeOut();
    for (let i = 0; i < 3; i++) { g.sfx('shutter'); await g.wait(260); }
    await g.fadeIn();
    await g.say('パシャッ！パシャッ！\n湯船をバックに、笑顔の一枚が撮れた！');
    await say(g, OKAMI, ['いい写真だねえ！', 'さっそく一枚、うちにも貼らせてもらうよ。\n番台の右の壁を見てごらん！']);
  } else {
    await say(g, OKAMI, '今度のポスターも評判いいよ！\nありがとね。');
  }
}

async function taishiJob(g) {
  const res = await g.job(SENTO_JOBS.taishi);
  if (!res) return;
  g.sfx('applause');
  await say(g, OKAMI, ['テレビでも紹介されてね、\n若いお客さんが増えたんだよ！', 'さすが、うちの自慢の常連さんだ！']);
}

async function okamiChat(g) {
  const lines = ['ここは「ドットの湯」。\n町の人の疲れを、毎日お湯で流してるのさ。'];
  if (!tier1(g)) lines.push('そうそう、うちでは「銭湯寄席」をやってるの。\n事務所に入るか、ちょっと名前が売れたら\n出てもらおうかね！');
  else if (g.state.fame < 250) lines.push('銭湯組合で、ポスターのモデルを探してるんだって。\nもっと有名になったら、あんたにお願いしようかね。');
  else lines.push('あんたのおかげで、うちも有名になってきたよ。\nありがたいねえ。');
  lines.push('お風呂でしっかり温まって、\n家でぐっすり寝る。これが一番の体力回復だよ。');
  await say(g, OKAMI, lines);
}

// The autograph board only appears on the wall once it has been signed (flag set in the fade).
async function signEvent(g) {
  const p = g.map.player;
  await g.emote('sento_okami', '!');
  await say(g, OKAMI, ['ねえ、{name}ちゃん。\nひとつ、お願いがあるんだけど…', 'うちの銭湯に、サインを飾らせてもらえないかい？']);
  g.sfx('chime');
  const fans = [['sento_kid', p.x - 1, p.y], ['sento_geinin', p.x + 1, p.y]].filter(([id]) => g.npc(id));
  await Promise.all(fans.map(([id, x, y]) => g.walkNpcTo(id, x, y, 1.5)));
  for (const [id] of fans) { const e = g.npc(id); if (e) e.dir = e.x < p.x ? 'right' : 'left'; }
  if (fans.length) {
    await Promise.all(fans.map(([id]) => g.emote(id, '♥')));
    if (g.npc('sento_kid')) await say(g, KID, 'すごーい！ほんもののサインだ！');
    if (g.npc('sento_geinin')) await say(g, GEININ, '…くっそー、オレもいつか書いてやる！\nでも今日は、素直におめでとう！');
  }
  await g.fadeOut();
  g.setFlag('sento_sign_done');
  g.sfx('applause');
  await g.wait(500);
  await g.fadeIn();
  await g.say('色紙に、心をこめてサインを書いた！\n番台の左の壁に飾られた。');
  await say(g, OKAMI, ['家宝にするよ！ありがとね。', 'お礼に、これからお風呂はずーっとタダ！\nいつでも温まりにおいで。']);
  g.setFlag('sento_vip');
  await Promise.all(fans.map(([id]) => { const e = g.npc(id); return e ? g.walkNpcTo(id, e.home.x, e.home.y) : null; }));
}

async function talkOkami(g, n) {
  if (g.state.fame >= 1000 && !g.flag('sento_sign_done')) await signEvent(g);
  const f = g.state.fame;
  const greet = f >= 1000 ? 'あら、スターのお出ましだ！\nいつもの、だね？'
    : f >= 250 ? 'あら、テレビで見たよ！\n常連さんたちも自慢してるんだから。'
      : f >= 30 ? 'おや、{name}ちゃん！\n最近ちょっと名前を聞くようになったね。'
        : 'いらっしゃい！今日もおつかれさん。';
  const bathLabel = today(g, 'sento_bath_day') ? 'お風呂（入浴済み）'
    : today(g, 'sento_paid_day') ? 'お風呂（支払い済み）' : `お風呂（${bathPrice(g) ? '¥500' : '無料'}）`;
  const items = [
    { label: bathLabel, run: () => payBath(g) },
    { label: '牛乳を買う', run: () => milkShop(g) },
  ];
  if (tier1(g)) items.push({ label: '銭湯寄席に出る', run: () => yoseJob(g) });
  if (f >= 250) items.push({ label: 'ポスター撮影', run: () => posterJob(g) });
  if (f >= 2000) items.push({ label: 'PR大使の仕事', run: () => taishiJob(g) });
  items.push({ label: '話を聞く', run: () => okamiChat(g) });
  items.push({ label: 'やめておく', run: null });
  await menu(g, n, greet, items);
}

async function talkGeinin(g, n) {
  const st = g.state;
  if (st.fame >= 250) {
    await g.emote(n.id, '!');
    await say(g, n, ['おまえ、テレビ出てただろ！？', '…くっそー、オレも負けてらんねえ！\n今日も湯船でネタを考えるぞ！']);
    return;
  }
  const lines = ['よう。オレは売れない芸人。\nこの湯につかると、ネタが浮かぶんだ。\n…今日は浮かばなかったけど。'];
  if (!st.agency) lines.push('まずは事務所のオーディションだな。\nよしもとやグレープカンパニーは、この近所だぜ。\nなんばに行けば、松竹芸能もある。');
  else lines.push('{agency}に入ったのか！先を越された！', '所属タレントなら、おかみさんに頼めば\nここの「銭湯寄席」にも出られるぜ。');
  lines.push('東京駅から新幹線で大阪へ行けば、\nなんばは電車ですぐだ。\nたこ焼き屋のバイトは、誰でもできるらしいぜ。');
  await say(g, n, lines);
}

async function talkKid(g, n) {
  await g.emote(n.id, '♪');
  await say(g, n, ['おふろあがりは、フルーツ牛乳！', 'コーヒー牛乳はね、こしに手をあてて\nいっきに飲むのが作法なんだって！', 'マッサージチェアは、100円でブルブルするよ〜。']);
}

async function massage(g) {
  if (today(g, 'sento_massage_day')) { await g.say('マッサージチェアだ。\n今日はもう、十分ほぐれた。'); return; }
  const i = await g.ask(`マッサージチェアだ。\n¥100で、肩こりがほぐれるらしい。\n（体力 +5・ストレス -${MASSAGE_STRESS}）`, ['すわる', 'やめておく']);
  if (i !== 0) return;
  if (!g.spend(100)) { await g.say('100円玉が見つからない…。'); return; }
  g.sfx('coin');
  g.setFlag('sento_massage_day', g.state.day);
  g.shake(40, 1);
  await g.say('ウィーン…ゴリゴリゴリ……\nあ゛〜〜、そこそこ……。');
  g.heal(5);
  const ds = -g.addNeed('stress', -MASSAGE_STRESS);
  g.sfx('good');
  await g.say(`肩こりがほぐれた！\n（体力 +5${ds > 0 ? `・ストレス -${ds}` : ''}）`);
}

// The cozy bath cutscene. side: 'm' (男湯) | 'f' (女湯)
async function soak(g, side) {
  const p = g.map.player;
  const col = p.x;
  if (today(g, 'sento_bath_day')) { await g.say('今日はもう、たっぷり温まった。\nまた明日来よう！'); return; }
  if (!today(g, 'sento_paid_day')) {
    await g.say('番台のほうから、おかみさんの声がした。');
    const label = bathPrice(g) ? '払う（¥500）' : 'おねがいします';
    const i = await g.ask('お客さ〜ん、お代がまだだよ〜！', [label, 'やめておく'], who(OKAMI));
    if (i !== 0) return;
    if (!(await payBath(g))) return;
  }
  const i = await g.ask(`大きな湯船だ。\nゆっくりつかって、温まる？\n（${BATH_EFFECT}）`, ['つかる', 'やめておく']);
  if (i !== 0) return;
  await g.say('まずは、かけ湯をして…\nざばーっ！');
  g.sfx('hit');
  await g.fadeOut();
  bathing = { x: col };
  p.hidden = true;
  g.placePlayer(col, 4, 'down');
  await g.wait(200);
  await g.fadeIn();
  g.sfx('hit');
  await g.say('カポーン……');
  await g.emote('player', '♪');
  await g.say(['ふぅ〜〜〜……\nいいお湯だ……。', '見上げると、大きな富士山の絵。\n湯けむりの向こうで、どっしり構えている。']);
  if (side === 'm' && g.npc('sento_goinkyo')) {
    await g.emote('sento_goinkyo', '♪');
    await say(g, GOINKYO, ['（ふんふふ〜ん♪）\nおう、いい湯だろう？', '肩までつかって、ゆーっくり百数えな。\n疲れなんて、お湯に溶けちまうよ。']);
  } else if (side === 'f' && g.npc('sento_obaachan')) {
    await g.emote('sento_obaachan', '♪');
    await say(g, OBAACHAN, ['あら、いい顔になってきたわね。', 'お湯につかるとね、気持ちもほぐれるの。\n明日もきっと、いいことあるわよ。']);
  }
  await g.say('体の芯まで、ぽっかぽかだ……。');
  await g.fadeOut(24);
  const before = g.state.stamina;
  g.heal(BATH_HEAL);
  const dh = g.state.stamina - before;
  const dc = g.bathe(100, true);
  const ds = -g.addNeed('stress', -BATH_STRESS);
  g.setFlag('sento_bath_day', g.state.day);
  bathing = null;
  p.hidden = false;
  g.placePlayer(col, 6, 'down');
  await g.wait(400);
  await g.fadeIn(24);
  g.sfx('good');
  await g.emote('player', '♥');
  const what = [dh > 0 ? `体力 +${dh}` : '', dc > 0 ? `身だしなみ +${dc}` : '', ds > 0 ? `ストレス -${ds}` : ''].filter(Boolean).join('・');
  await g.say([`お風呂でしっかり温まった！\n体も心も、さっぱりした。${what ? `\n（${what}）` : ''}`, '風呂上がりには、番台のコーヒー牛乳がおすすめだ！']);
}

// Steam rising from both tubs.
function drawSteam(ctx, g, cam) {
  const t = g.frame;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 16; i++) {
    const baseX = (i % 2 ? 11 : 1) * TILE;
    const k = ((t * 0.45 + i * 41) % 170) / 170;
    const x = Math.round(baseX + ((i * 53) % (7 * TILE)) + Math.sin(t / 45 + i) * 4 - cam.x);
    const y = Math.round(5 * TILE - k * 60 - cam.y);
    ctx.globalAlpha = 0.3 * Math.sin(k * Math.PI);
    const s = 3 + Math.round(k * 5);
    ctx.fillRect(x, y, s * 2, s);
    ctx.fillRect(x + 2, y - 2, s * 2 - 4, 2);
  }
  ctx.restore();
}

const SENTO_GOSSIP = [
  'スポーツ新聞の芸能面：\n「新人俳優、時代劇で堂々の主演デビュー！」',
  '芸能雑誌：「お笑いコンビ、結成10年目で\n初の単独ライブ！チケットは即完売」',
  '芸能雑誌：「人気アイドルの趣味は銭湯めぐり！？\n湯上がりの一杯はフルーツ牛乳派」',
  '芸能雑誌：「売れっ子の共通点は、あいさつと体力。\nよく食べ、よく寝て、よくお風呂！」',
];
let sentoGossipIdx = 0;

async function sentoIntro(g) {
  if (!(await firstEnter(g, 'sento_met'))) return;
  g.sfx('hit');
  await g.say('カポーン……\n奥から、おけの音がひびいてくる。');
  await g.emote('sento_okami', '!');
  await say(g, OKAMI, ['いらっしゃい！ドットの湯へようこそ。', 'お風呂は大人¥500。番台で払っておくれ。\n左ののれんが男湯、右が女湯だよ！']);
  await g.emote('sento_kid', '♪');
  await say(g, KID, 'おふろあがりのフルーツ牛乳、さいこう〜！');
}

function drawSentoSign(ctx, sx, sy) {
  R(ctx, sx + 1, sy + 1, 62, 14, '#3a2512');
  R(ctx, sx + 2, sy + 2, 60, 12, '#6e4428');
  R(ctx, sx + 2, sy + 2, 60, 1, '#8e5e36');
  text(ctx, 'ドットの湯', sx + 32, sy + 2, { size: 10, align: 'center', color: '#fff6e0', shadow: '#2a1a10' });
}

registerPlace({
  id: 'sento',
  name: '銭湯 ドットの湯',
  kind: 'building',
  bgm: 'sento_yu',
  start: { room: 'lobby', x: 7, y: 7, dir: 'up' },
  rooms: {
    // ------------------------------------------------------------ 番台・休憩所
    lobby: {
      floor: 'floor_wood',
      wall: 'cream',
      tiles: [
        '################',
        '#=c=AB====CD=HV#',
        '#FF...sOGs....m#',
        '#......KK......#',
        '#..............#',
        '#..........bb.f#',
        '#..........tt..#',
        '#UU.........P.U#',
        '#######MM#######',
      ],
      legend: {
        A: 'sento_noren_ml', B: 'sento_noren_mr', C: 'sento_noren_fl', D: 'sento_noren_fr',
        H: 'wall_cream+sento_board', F: 'sento_milkcase', s: 'sento_bandai_side', O: 'sento_bandai_floor',
        G: 'sento_bandai_goods', K: 'sento_bandai_front', m: 'sento_massage', f: 'sento_fan',
        b: 'bench', t: 'table_low', U: 'sento_getabako', P: 'plant', V: 'wall_cream+tv_wall',
      },
      warps: [
        { x: 7, y: 8, to: 'exit' }, { x: 8, y: 8, to: 'exit' },
        { x: 4, y: 1, room: 'bath', tx: 4, ty: 11, dir: 'up', check: norenCheck },
        { x: 5, y: 1, room: 'bath', tx: 5, ty: 11, dir: 'up', check: norenCheck },
        { x: 10, y: 1, room: 'bath', tx: 14, ty: 11, dir: 'up', check: norenCheck },
        { x: 11, y: 1, room: 'bath', tx: 15, ty: 11, dir: 'up', check: norenCheck },
      ],
      entities: [
        { type: 'prop', x: 6, y: 1, w: 4, h: 1, solid: false, draw: drawSentoSign },
        {
          type: 'prop', x: 2, y: 5, w: 2, h: 1,
          text: ['小さな高座だ。紫の座布団が敷いてある。', 'めくりに「ドットの湯 寄席」と書いてある。\nここで、ときどき寄席が開かれるらしい。'],
          draw(ctx, sx, sy) {
            shadowEllipse(ctx, sx + 16, sy + 15, 15, 1);
            R(ctx, sx + 1, sy + 4, 30, 4, '#c99660'); R(ctx, sx + 1, sy + 4, 30, 1, '#e0b47c');
            R(ctx, sx + 1, sy + 8, 30, 7, '#8a2a3a'); R(ctx, sx + 1, sy + 8, 30, 1, '#b8404e');
            R(ctx, sx + 5, sy + 1, 12, 5, '#7a4aa8'); R(ctx, sx + 5, sy + 1, 12, 1, '#a07ad0');
            R(ctx, sx + 21, sy - 9, 1, 13, '#5a3a20'); R(ctx, sx + 29, sy - 9, 1, 13, '#5a3a20');
            R(ctx, sx + 20, sy - 10, 11, 1, '#5a3a20');
            R(ctx, sx + 22, sy - 9, 7, 11, '#fbf6ea');
            for (let i = 0; i < 4; i++) R(ctx, sx + 25, sy - 7 + i * 2, 1, 1, '#20232a');
          },
        },
        {
          type: 'prop', x: 12, y: 1, w: 1, h: 1, cond: (g) => !!g.flag('sento_poster_done'),
          text: ['{name}が笑顔でうつった、銭湯のポスターだ。', '「ひとっ風呂、浴びていこう！」\n…ちょっと照れくさい。'],
          draw(ctx, sx, sy, g) {
            R(ctx, sx + 1, sy - 3, 14, 17, '#20232a');
            R(ctx, sx + 2, sy - 2, 12, 15, '#9ad3f5');
            R(ctx, sx + 2, sy + 8, 12, 5, SB);
            drawFace(ctx, g.state.look || {}, sx + 2, sy - 1, 0.75);
            R(ctx, sx + 2, sy + 8, 12, 1, '#ffffff');
            R(ctx, sx + 4, sy + 10, 8, 1, '#ffffff');
          },
        },
        {
          type: 'prop', x: 3, y: 1, w: 1, h: 1, cond: (g) => !!g.flag('sento_sign_done'),
          text: '{name}のサイン色紙が飾られている。\n「ドットの湯さんへ」と書いてある。',
          draw(ctx, sx, sy) {
            R(ctx, sx + 2, sy, 12, 13, '#c9a227');
            R(ctx, sx + 3, sy + 1, 10, 11, '#fffdf4');
            for (let i = 0; i < 7; i++) R(ctx, sx + 4 + i, sy + 4 + Math.round(Math.sin(i * 1.3) * 2), 1, 2, '#20232a');
            R(ctx, sx + 5, sy + 8, 6, 1, '#20232a');
            R(ctx, sx + 10, sy + 9, 2, 2, '#d62f2f');
          },
        },
        npc('sento_okami', 7, 2, 'down', OKAMI.look, OKAMI.name, { talk: talkOkami }),
        npc('sento_kid', 4, 4, 'down', KID.look, KID.name, { wander: 1, talk: talkKid }),
        npc('sento_geinin', 10, 5, 'down', GEININ.look, GEININ.name, { wander: 1, talk: talkGeinin }),
      ],
      events: [
        { x: 1, y: 2, w: 2, on: 'action', run: (g) => g.say(['冷蔵ケースに、瓶の牛乳がずらり。', 'コーヒー牛乳に、フルーツ牛乳…。\nお買い上げは、番台のおかみさんへ。']) },
        { x: 14, y: 2, on: 'action', run: massage },
        { x: 13, y: 1, on: 'action', run: (g) => g.say(['掲示板だ。', '【ドットの湯】入浴料 大人¥500\n「銭湯寄席 出演者募集中！」\n「迷子の手ぬぐい、番台で預かってます」']) },
        { x: 1, y: 7, w: 2, on: 'action', run: (g) => g.say('木の下駄箱だ。\n木の札が、そのまま鍵になっている。') },
        { x: 14, y: 7, on: 'action', run: (g) => g.say('木の下駄箱だ。\n「松」「竹」「梅」…札に字が書いてある。') },
        { x: 14, y: 5, on: 'action', run: (g) => g.say('扇風機が首を振っている。\n風呂上がりの体に、たまらない風！') },
        { x: 11, y: 5, w: 2, on: 'action', run: (g) => g.say('休憩用のベンチだ。\n風呂上がりの人たちが、ここでひと休みする。') },
        {
          x: 11, y: 6, w: 2, on: 'action',
          run: async (g) => { await g.say(['テーブルの上に、新聞と芸能雑誌が置いてある。', SENTO_GOSSIP[sentoGossipIdx++ % SENTO_GOSSIP.length]]); },
        },
      ],
      drawUnder(ctx, g, cam) {
        text(ctx, '男', 5 * TILE - cam.x, TILE + 3 - cam.y, { size: 10, align: 'center', color: '#ffffff', shadow: null });
        text(ctx, '女', 11 * TILE - cam.x, TILE + 3 - cam.y, { size: 10, align: 'center', color: '#ffffff', shadow: null });
      },
      // started with g.run so the room finishes loading first (the cutscene keeps the player busy)
      onEnter: (g) => { if (!g.flag('sento_met')) g.run(sentoIntro); },
    },

    // ------------------------------------------------------------ 浴室（男湯｜女湯）＋脱衣所
    bath: {
      floor: 'sento_floor',
      wall: 'white',
      bgm: 'sento_yu',
      entry: { x: 4, y: 11, dir: 'up' },
      tiles: [
        '####################',
        '#' + muralRow(0) + '#',
        '#' + muralRow(1) + '#',
        '#' + muralRow(2) + '#',
        '#TTTTTTTT[]TTTTTTTT#',
        '#EEEEEEEE[]EEEEEEEE#',
        '#........[]........#',
        '#.KKK....[]....KKK.#',
        '#.ooo....[]....ooo.#',
        '#GGGGGdGG[]GGdGGGGG#',
        '#L,,,,,f,[],f,,,,,L#',
        '#Lbs,,,,,[],,,,,sbL#',
        '####XX########XX####',
      ],
      legend: {
        ...MURAL_LEGEND,
        T: 'sento_tub', E: 'sento_rim', '[': 'sento_partition_l', ']': 'sento_partition_r',
        K: 'sento_karan', o: 'sento_oke', G: 'sento_glass', d: 'sento_glassdoor',
        ',': 'sento_goza', L: 'sento_goza+sento_locker', f: 'sento_goza+sento_fan', b: 'sento_goza+sento_basket',
        s: 'sento_goza+sento_scale', X: 'exit_mat',
      },
      warps: [
        { x: 4, y: 12, room: 'lobby', tx: 4, ty: 2, dir: 'down' },
        { x: 5, y: 12, room: 'lobby', tx: 5, ty: 2, dir: 'down' },
        { x: 14, y: 12, room: 'lobby', tx: 10, ty: 2, dir: 'down' },
        { x: 15, y: 12, room: 'lobby', tx: 11, ty: 2, dir: 'down' },
      ],
      entities: [
        bather('sento_goinkyo', 3, 4, GOINKYO, '#ffffff', async (g, e) => {
          await g.emote(e.id, '♪');
          const lines = ['（ふんふふ〜ん♪）\nおう、若いの。熱いのは平気かい？', 'うしろの富士山はな、「ペンキ絵」ってんだ。\n銭湯がお休みの日に、職人さんが\n一日で描き上げるんだとさ。'];
          if (g.state.fame >= 250) lines.push('…ん？おまえさん、どこかで見た顔だな。\nそうだ、テレビだ！長生きはするもんだ！');
          else lines.push('昔このへんに住んでた売れない役者がな、\n今じゃ時代劇の主役だそうだ。\n人生、わからんもんだよ。');
          lines.push('芸の道は体が資本だ。\nよく食って、よく寝て、よく風呂に入るこった！');
          await say(g, e, lines);
        }),
        bather('sento_obaachan', 16, 4, OBAACHAN, '#ffb3c8', async (g, e) => {
          await g.emote(e.id, '♪');
          const lines = ['（ちゃぷん…）\nあらまあ、いらっしゃい。お湯加減はどう？', 'ここのお湯に入るとね、お肌がつるつるになるの。\nテレビに出る人は、顔が命だものねえ。'];
          if (g.state.fame >= 250) lines.push('あなた、テレビで見たわよ！\nさっそく孫に自慢しなくっちゃ。');
          else lines.push('若いころはね、私も歌手を目指してたの。\n…ほんとよ？ラ〜ララ〜♪');
          await say(g, e, lines);
        }),
        {
          type: 'prop', id: 'sento_me', x: 0, y: 4, w: 1, h: 1, solid: false, cond: () => !!bathing,
          draw(ctx, sx, sy, g) {
            if (!bathing) return;
            drawBather(ctx, bathing.x * TILE - g.map.cam.x, sy, g.state.look || {}, g.frame, '#ffffff', bathing.x);
          },
        },
        npc('sento_waka', 7, 7, 'left', WAKA.look, WAKA.name, {
          talk: async (g, n) => {
            const lines = ['あ、どうも！おかみさんの息子です。\n毎朝、デッキブラシでピカピカにしてます！', 'お湯はちょっと熱めの42度。\n入る前に、かけ湯をしてくださいね。'];
            if (g.state.fame < 250) lines.push('銭湯組合の人が、ポスターのモデルを\n探してるんです。名前が売れてきたら、\nきっと声がかかりますよ！');
            else if (!g.flag('sento_poster_done')) lines.push('そうだ！銭湯のポスターのモデルの件、\nおかみさんに話してみてください！');
            else lines.push('ポスター、評判いいですよ！\n見た人が、銭湯に来てくれるんです。');
            await say(g, n, lines);
          },
        }),
        npc('sento_ojisan', 7, 11, 'up', OJISAN.look, OJISAN.name, {
          talk: async (g, n) => {
            const lines = ['風呂上がりは、この扇風機の前が特等席なんだ。', '聞いたかい？夕方のバラエティで、\n新人の一般オーディションをやるらしいよ。\n…ま、うわさだけどね！'];
            if (!g.state.agency) lines.push('芸能界に入りたいなら、まずは事務所だね。\n事務所のオーディションは、毎日やってるそうだ。');
            else lines.push('{agency}に所属してるんだって？\nそりゃすごい！応援してるよ！');
            await say(g, n, lines);
          },
        }),
        npc('sento_oneesan', 12, 11, 'up', ONEESAN.look, ONEESAN.name, {
          text: ['小さな劇団で、役者をしてるの。\n本番前は、ここで体をほぐすのが日課。', '演技を磨きたいなら、撮影所やスタジオへ。\n東映の撮影所や、東宝のスタジオがあるでしょう？', 'お風呂で百面相の練習をしてたら、\nおばあちゃんに笑われちゃった。'],
        }),
      ],
      events: [
        { x: 1, y: 5, w: 8, on: 'action', run: (g) => soak(g, 'm') },
        { x: 11, y: 5, w: 8, on: 'action', run: (g) => soak(g, 'f') },
        { x: 2, y: 7, w: 3, on: 'action', run: (g) => g.say('カランと鏡だ。\nまずはここで体を洗ってから、湯船へ！') },
        { x: 15, y: 7, w: 3, on: 'action', run: (g) => g.say('カランと鏡だ。\n鏡にうつる自分の顔が、ほかほかしている。') },
        { x: 2, y: 8, w: 3, on: 'action', run: (g) => g.say('黄色いおけと、風呂いすだ。\nおけを置くと、カポーンといい音がする。') },
        { x: 15, y: 8, w: 3, on: 'action', run: (g) => g.say('黄色いおけと、風呂いすが\nきれいに並べてある。') },
        { x: 1, y: 10, h: 2, on: 'action', run: (g) => g.say('木のロッカーだ。\n脱いだ服は、ここにしまっておこう。') },
        { x: 18, y: 10, h: 2, on: 'action', run: (g) => g.say('木のロッカーだ。\n鍵には、ゴムのバンドがついている。') },
        { x: 7, y: 10, on: 'action', run: (g) => g.say('扇風機が首を振っている。\n風呂上がりの体に、たまらない風！') },
        { x: 12, y: 10, on: 'action', run: (g) => g.say('扇風機が首を振っている。\n「あ〜〜」と声を出したくなる。') },
        { x: 3, y: 11, on: 'action', run: (g) => g.say('昔ながらの体重計だ。\n…今日は乗るのはやめておこう。') },
        { x: 16, y: 11, on: 'action', run: (g) => g.say('昔ながらの体重計だ。\n針がぷるぷるゆれている。') },
        { x: 2, y: 11, on: 'action', run: (g) => g.say('脱衣かごだ。\n手ぬぐいが、たたんで入っている。') },
        { x: 17, y: 11, on: 'action', run: (g) => g.say('脱衣かごだ。\nだれかの手ぬぐいが、ていねいにたたまれている。') },
      ],
      drawOver: drawSteam,
      onEnter: async (g) => {
        bathing = null;
        g.map.player.hidden = false;
      },
    },
  },
});

// ====================================================================== ホテル tiles
defineTile('hotel_wall', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#efe2c4'); R(c, 0, 0, 16, 1, '#fbf2dc'); R(c, 0, 1, 16, 1, '#e2d2b0');
    R(c, 7, 2, 1, 7, '#e6d7b8'); R(c, 15, 2, 1, 7, '#e6d7b8');
    R(c, 0, 9, 16, 1, '#c9a227');
    R(c, 0, 10, 16, 6, '#6e4426'); R(c, 0, 10, 16, 1, '#8e5e36');
    R(c, 3, 11, 1, 4, '#5a361c'); R(c, 11, 11, 1, 4, '#5a361c');
    R(c, 0, 15, 16, 1, '#3e2412');
  },
});
defineTile('hotel_carpet', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#7a2a3a');
    for (const [x, y] of [[4, 4], [12, 12]]) {
      P(c, x, y - 1, '#d8b04a'); P(c, x - 1, y, '#d8b04a'); P(c, x + 1, y, '#d8b04a'); P(c, x, y + 1, '#d8b04a');
    }
    P(c, 12, 4, '#9a3a4c'); P(c, 4, 12, '#9a3a4c');
  },
});
function hotelCounter(c) {
  R(c, 0, 1, 16, 6, '#f2efe8'); R(c, 0, 1, 16, 1, '#ffffff'); R(c, 0, 6, 16, 1, '#d8d2c4');
  R(c, 0, 7, 16, 9, '#5a3420'); R(c, 0, 7, 16, 1, '#c9a227');
  for (let x = 1; x < 16; x += 5) R(c, x, 9, 3, 5, '#6e4428');
  R(c, 0, 15, 16, 1, '#3a2010');
}
defineTile('hotel_counter', { solid: true, obj: true, talkThrough: true, draw: hotelCounter });
defineTile('hotel_counter_bell', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    hotelCounter(c);
    R(c, 9, 3, 5, 2, '#e8c43a'); R(c, 10, 2, 3, 1, '#fff6a8'); R(c, 8, 5, 7, 1, '#9a7a1a'); P(c, 11, 1, '#9a7a1a');
    R(c, 2, 3, 4, 3, '#ffffff'); R(c, 3, 4, 2, 1, '#9aa0aa');
  },
});
defineTile('hotel_counter_side', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 0, 10, 16, '#5a3420'); R(c, 4, 0, 8, 15, '#f2efe8'); R(c, 4, 0, 1, 15, '#ffffff');
    R(c, 3, 15, 10, 1, '#3a2010');
  },
});
defineTile('hotel_podium', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 5, 1);
    R(c, 3, 5, 10, 10, '#6e4426'); R(c, 3, 5, 10, 1, '#9a6a40');
    R(c, 2, 2, 12, 3, '#8e5a30'); R(c, 2, 2, 12, 1, '#c9a227');
    R(c, 5, 8, 6, 4, '#5a361c'); R(c, 6, 9, 4, 2, '#c9a227');
    R(c, 11, 0, 1, 3, '#3b3f48'); R(c, 10, 0, 3, 1, '#fff2c0');
  },
});
function hotelDoor(c, left) {
  R(c, 0, 0, 16, 16, '#4a2a16');
  R(c, left ? 1 : 0, 1, 15, 15, '#7a4a26');
  R(c, left ? 3 : 2, 4, 11, 4, '#8e5a30'); R(c, left ? 3 : 2, 9, 11, 6, '#8e5a30');
  R(c, left ? 14 : 1, 8, 1, 4, '#e8c43a');
  R(c, 0, 0, 16, 1, '#c9a227');
}
defineTile('hotel_door_l', { solid: true, draw(c) { hotelDoor(c, true); } });
defineTile('hotel_door_r', { solid: true, draw(c) { hotelDoor(c, false); } });
defineTile('hotel_sofa_up', {
  solid: true, obj: true,
  draw(c) {
    const col = '#c9b48e';
    shadowEllipse(c, 8, 15, 8, 1);
    R(c, 0, 3, 16, 6, col); R(c, 0, 3, 16, 1, shade(col, 0.25));
    R(c, 0, 8, 16, 6, shade(col, -0.2)); R(c, 0, 8, 16, 1, shade(col, 0.05));
    R(c, 7, 9, 1, 5, shade(col, -0.32)); R(c, 0, 14, 16, 1, shade(col, -0.45));
  },
});
defineTile('hotel_cart', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 7, 1);
    R(c, 1, 12, 14, 2, '#c9a227'); R(c, 2, 14, 2, 2, '#20232a'); R(c, 12, 14, 2, 2, '#20232a');
    R(c, 2, 0, 1, 12, '#e8c43a'); R(c, 13, 0, 1, 12, '#e8c43a'); R(c, 2, 0, 12, 1, '#e8c43a');
    R(c, 4, 6, 8, 6, '#3a58a8'); R(c, 4, 6, 8, 1, '#5a78c8'); R(c, 7, 5, 2, 1, '#20232a');
    R(c, 5, 2, 6, 4, '#c8323f'); R(c, 5, 2, 6, 1, '#e05462');
  },
});
defineTile('hotel_sconce', {
  solid: true, obj: true,
  draw(c) {
    c.fillStyle = 'rgba(255,230,150,0.25)'; c.fillRect(3, 1, 10, 9);
    R(c, 6, 7, 4, 2, '#c9a227'); R(c, 5, 2, 6, 5, '#fff2c0'); R(c, 5, 2, 6, 1, '#ffffff'); R(c, 7, 9, 2, 2, '#8a6a1a');
  },
});
defineTile('hotel_clocks', {
  solid: true, obj: true,
  draw(c) {
    for (let i = 0; i < 3; i++) {
      const x = 3 + i * 5;
      disc(c, x, 5, 2, '#c9a227'); P(c, x, 5, '#ffffff'); P(c, x, 4, '#ffffff'); P(c, x + 1, 5, '#ffffff');
      R(c, x - 1, 9, 3, 1, '#8a6a1a');
    }
  },
});
function skyline(c, part, f) {
  R(c, 0, 1, 16, 12, '#f2efe8'); R(c, 0, 1, 16, 1, '#ffffff');
  const L = part === 'l' ? 2 : 0, Rr = part === 'r' ? 14 : 16;
  R(c, L, 2, Rr - L, 10, '#18204a'); R(c, L, 8, Rr - L, 4, '#232c5c');
  const seed = { l: 1, m: 5, n: 3, r: 7 }[part];
  for (let i = 0; i < 6; i++) {
    const x = L + ((i * 5 + seed) % Math.max(1, Rr - L - 2));
    const h = 3 + ((i * 7 + seed) % 6);
    R(c, x, 12 - h, 3, h, '#0d1230');
    if ((i + f + seed) % 2) P(c, x + 1, 13 - h, '#ffe36e');
    P(c, x, 14 - h, '#fff6a8');
  }
  if (part === 'm') { R(c, 3, 4, 6, 2, f ? '#ff4f8b' : '#ff7eb6'); R(c, 10, 5, 3, 1, '#5fd7ff'); }
  if (part === 'n') { R(c, 5, 3, 1, 4, '#ffd23f'); R(c, 8, 5, 4, 1, f ? '#5ee07a' : '#5fd7ff'); }
  P(c, L + 3, 3, '#ffffff'); P(c, Math.min(Rr - 2, L + 9), 4, '#ffffff');
  if (part === 'l') { R(c, 0, 1, 2, 12, '#d8d2c4'); R(c, 2, 2, 2, 10, '#c9a46a'); R(c, 2, 2, 1, 10, '#e2c48e'); }
  if (part === 'r') { R(c, 14, 1, 2, 12, '#d8d2c4'); R(c, 12, 2, 2, 10, '#c9a46a'); R(c, 13, 2, 1, 10, '#a8844a'); }
  R(c, 0, 12, 16, 1, '#c8c2b4');
}
for (const part of ['l', 'm', 'n', 'r']) {
  defineTile('hotel_win_' + part, { solid: true, obj: true, frames: 2, speed: 50, draw(c, r, f) { skyline(c, part, f); } });
}
defineTile('hotel_lampstand', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 6, 1);
    R(c, 2, 8, 12, 7, '#7a4a26'); R(c, 2, 8, 12, 1, '#9a6a40'); R(c, 3, 11, 10, 1, '#5a361c'); P(c, 8, 13, '#c9a227');
    R(c, 7, 4, 2, 4, '#c9a227'); R(c, 4, 0, 8, 5, '#fff2c0'); R(c, 4, 0, 8, 1, '#ffffff'); R(c, 4, 4, 8, 1, '#e8d8a0');
  },
});
defineTile('hotel_suitcase', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 6, 1);
    R(c, 3, 4, 10, 11, '#d64161'); R(c, 3, 4, 10, 1, '#f06a88'); R(c, 3, 14, 10, 1, '#9a2a44');
    R(c, 6, 1, 4, 1, '#3b3f48'); R(c, 6, 1, 1, 3, '#3b3f48'); R(c, 9, 1, 1, 3, '#3b3f48');
    R(c, 3, 9, 10, 1, '#9a2a44'); R(c, 5, 6, 3, 2, '#ffe36e');
  },
});

// ====================================================================== ホテル people & content
const FRONT = { name: 'フロント係', look: { ...LOOKS.receptionist, top: '#1d2a5e', bottom: '#1d2a5e' } };
const BELL = { name: 'ベルスタッフ', look: { ...LOOKS.staff, hat: '#b02030', top: '#b02030', bottom: '#20232a', tie: '#c9a227' } };
const CONCIERGE = { name: 'コンシェルジュ', look: { ...LOOKS.announcer, top: '#1d2a5e', bottom: '#1d2a5e', hairColor: 'black' } };
const BANQUET = { name: '宴会場マネージャー', look: { ...LOOKS.manager, top: '#20232a', bottom: '#20232a', tie: '#c9a227' } };
const BIZ = { name: '出張中の会社員', look: { ...LOOKS.salaryman, tie: '#d62f2f' } };
const H_MOM = { name: '旅行中のお母さん', look: LOOKS.mom };
const H_KID = { name: 'こども', look: { ...LOOKS.kid, top: '#5ee07a' } };

const HOTEL_PRICE = 3000;
const hotelFree = (g) => g.state.fame >= 2000;
let escorting = false; // the bellhop is shown in the guest room during the check-in cutscene

const HOTEL_TV = [
  '『なんばの劇場では、今日も新喜劇が大盛況！\nお約束のズッコケに、客席も大爆笑です』',
  '『大阪の芸能事務所のオーディションでは、\nしゃべりの腕が試されるそうですよ』',
  '『大阪名物たこ焼き！外はカリッ、中はトロッ。\nお店ではアルバイトも募集中だとか』',
  '『東京へは、なんば駅から電車と新幹線で。\n運賃は¥3,000です。いってらっしゃい！』',
  '『天気予報です。なんばは、あしたも\n笑顔あふれる晴れ模様でしょう』',
];
let hotelTvIdx = 0;

const WEDDING_SCENES = [
  { prompt: '新郎「き、緊張してきました…」', answers: [
    { text: '深呼吸、いきましょう！', score: 100 },
    { text: '私もです…', score: 30 },
    { text: '帰りますか？', score: 0 },
  ] },
  { prompt: '乾杯の前に、司会からひとこと！', answers: [
    { text: 'では、いただきます', score: 20 },
    { text: 'おふたりに拍手を！', score: 100 },
    { text: '…えーっと', score: 0 },
  ] },
  { prompt: '友人「スピーチ、忘れちゃった！」', answers: [
    { text: '思い出話でいきましょう', score: 100 },
    { text: 'アドリブでどうぞ', score: 50 },
    { text: '飛ばしましょう', score: 10 },
  ] },
  { prompt: 'ケーキ入刀！ひとことどうぞ！', answers: [
    { text: 'おいしそう！', score: 40 },
    { text: '切れ味バツグン！', score: 30 },
    { text: '初めての共同作業です！', score: 100 },
  ] },
];
const HOTEL_JOBS = {
  yokyo: {
    id: 'hotel_yokyo', title: '会社の宴会で余興', client: BANQUET.name, clientLook: BANQUET.look,
    desc: '社員旅行の宴会で、新喜劇風のコント！', stamina: 20,
    minigame: 'zukko', opts: { difficulty: 2 },
    pay: 4000, fame: 15, skill: 'warai', gain: 2, requires: TIER1,
  },
  wedding: {
    id: 'hotel_wedding', title: '結婚披露宴の司会', client: BANQUET.name, clientLook: BANQUET.look,
    desc: '幸せいっぱいの披露宴を盛り上げよう！', stamina: 25,
    minigame: 'talk', opts: { difficulty: 3, topic: '結婚披露宴', scenes: WEDDING_SCENES },
    pay: 11000, fame: 40, skill: 'talk', gain: 3, requires: { fame: 250 },
  },
  dinner: {
    id: 'hotel_dinner', title: 'ディナーショー', client: BANQUET.name, clientLook: BANQUET.look,
    desc: '宴会場が満席！しっとり歌い上げよう！', stamina: 30,
    minigame: 'rhythm', opts: { difficulty: 4, lanes: 4, song: 'なにわナイト・セレナーデ' },
    pay: 30000, fame: 100, skill: 'uta', gain: 4, requires: { fame: 1000 },
  },
};

async function goToRoom(g, withBell) {
  const bell = g.npc('hotel_bell');
  if (withBell && bell) {
    await say(g, BELL, 'お部屋までご案内いたします！\nどうぞ、こちらへ。');
    await g.walkNpcTo('hotel_bell', 15, 2);
    await g.moveNpc('hotel_bell', 'face:up');
  }
  await walkPlayerTo(g, 14, 2, 'up');
  g.sfx('chime');
  await g.say('チーン♪\nエレベーターのドアが開いた。');
  escorting = withBell;
  await g.goto('hotel', 'room', 5, 6, 'up');
  if (withBell && g.npc('hotel_bell2')) {
    g.npc('hotel_bell2').dir = 'left';
    await say(g, BELL, ['こちらが本日のお部屋でございます。', 'ベッドでお休みになると、体力が全回復して\n次の日になります。セーブもされますよ。', 'それでは、ごゆっくりお過ごしくださいませ！']);
    await g.moveNpc('hotel_bell2', 'down');
    g.sfx('door');
  }
  escorting = false;
}

async function frontChat(g) {
  await say(g, FRONT, [
    'ご宿泊いただくと、体力が全回復して\n次の日になります。セーブも自動で行われます。',
    'なんばのご案内は、となりのコンシェルジュへ\nどうぞお気軽に。',
    '宴会場では、余興や司会のお仕事を\nお願いすることもございます。',
  ]);
}

async function talkFront(g) {
  if (g.flag('hotel_stay') === g.state.day) {
    const i = await ask(g, FRONT, 'お部屋のご用意ができております。\nエレベーターで客室へどうぞ。', ['部屋へ行く', '話を聞く', 'やめておく']);
    if (i === 0) await goToRoom(g, false);
    else if (i === 1) await frontChat(g);
    return;
  }
  const greet = hotelFree(g) ? 'ようこそお越しくださいました、{name}様。\nいつもありがとうございます。' : 'いらっしゃいませ。\nドットホテル なんばへようこそ。';
  const label = hotelFree(g) ? '泊まる（ご招待）' : '泊まる（¥3,000）';
  const i = await ask(g, FRONT, greet, [label, '話を聞く', 'やめておく']);
  if (i === 1) { await frontChat(g); return; }
  if (i !== 0) return;
  if (hotelFree(g)) {
    await say(g, FRONT, ['いつもごひいきの{name}様には、\nご宿泊を無料でご招待させていただきます！', 'いちばん眺めのいいお部屋を\nご用意いたしました。']);
  } else {
    if (!g.spend(HOTEL_PRICE)) {
      await say(g, FRONT, ['申し訳ございません。\nご宿泊は、1泊¥3,000でございます…。', canRestInBack(g) ? 'お困りでしたら、となりのたこ焼き屋の\n大将に相談なさってはいかがでしょう。\n面倒見のいい方ですよ。' : 'またのお越しを、お待ちしております。']);
      return;
    }
    g.sfx('coin');
  }
  g.setFlag('hotel_stay', g.state.day);
  g.notify('ルームキーを受け取った', { color: '#fff' });
  await say(g, FRONT, ['ありがとうございます。\nこちらがルームキーでございます。', 'ベルスタッフが、お部屋までご案内いたします。']);
  await goToRoom(g, true);
}

async function talkConcierge(g) {
  const spots = [
    ['新喜劇の劇場', ['よしもと新喜劇の劇場は、\nこの通りを西へまっすぐ。赤い屋根が目印です。', 'みんなでそろってズッコケるのがお約束。\nよしもと所属なら、舞台に立てる日も…！']],
    ['松竹芸能', ['松竹芸能さんの事務所は、\nたこ焼き屋さんの先、劇場のおとなりです。', 'しゃべりの腕を磨きたい方は、\nオーディションに挑戦してみては？']],
    ['たこ焼き屋', ['ホテルのおとなりのたこ焼き屋さんは、\nなんばの名物でございます。', '「たこ焼き焼きのバイト」は、\nどなたでも歓迎だそうですよ。']],
    ['なんば駅', ['川を渡って南へ進むと、なんば駅です。', '電車で新大阪へ出て、新幹線で東京へ戻れます。\n運賃は¥3,000でございます。']],
  ];
  const i = await ask(g, CONCIERGE, 'コンシェルジュでございます。\nどちらのご案内をいたしましょう？', [...spots.map((s) => s[0]), 'けっこうです']);
  if (i < 0 || i >= spots.length) { await say(g, CONCIERGE, 'いつでもお声がけくださいませ。'); return; }
  await say(g, CONCIERGE, spots[i][1]);
}

async function talkBanquet(g) {
  const items = [];
  if (tier1(g)) items.push({ label: '宴会の余興', run: () => banquetJob(g, HOTEL_JOBS.yokyo) });
  if (g.state.fame >= 250) items.push({ label: '披露宴の司会', run: () => banquetJob(g, HOTEL_JOBS.wedding) });
  if (g.state.fame >= 1000) items.push({ label: 'ディナーショー', run: () => banquetJob(g, HOTEL_JOBS.dinner) });
  if (!items.length) {
    await say(g, BANQUET, ['宴会場の担当でございます。\n会社の宴会に結婚式、ディナーショーまで！', '事務所に所属なさるか、もう少しお名前が\n売れましたら、余興をお願いしたいですね。']);
    return;
  }
  items.push({ label: 'やめておく', run: null });
  await menu(g, BANQUET, 'いいところに！\n宴会場のお仕事、お願いできませんか？', items);
}

async function banquetJob(g, job) {
  const res = await g.job(job);
  if (!res) return;
  if ('SAB'.includes(res.rank)) {
    g.sfx('applause');
    const line = job === HOTEL_JOBS.dinner ? ['スタンディングオベーションでございます！', 'お客様が「また来年も」と\n口々におっしゃっていましたよ！']
      : job === HOTEL_JOBS.wedding ? ['すばらしい司会でした！', '新郎新婦も、涙と笑顔でいっぱいでしたよ。']
        : ['宴会場が、笑いでゆれておりました！', '幹事さんも大喜びです。'];
    await say(g, BANQUET, line);
  } else {
    await say(g, BANQUET, 'おつかれさまでございました。\n次回も、ぜひよろしくお願いいたします。');
  }
}

async function talkHotelKid(g, n) {
  await say(g, n, ['ぼく、あした新喜劇を見に行くんだ！\nズッコケの練習してるの。', 'お母さん、なにかギャグ言って！']);
  if (g.npc('hotel_mom')) await g.emote('hotel_mom', '…', 30);
  await say(g, H_MOM, 'えっ？えーと…\nふとんが、ふっとんだ！');
  g.sfx('zukko');
  g.shake(12, 2);
  await g.say('（こどもが、見事にズッコケた！）');
  await g.emote(n.id, 'w');
  await say(g, n, 'ね、うまいでしょ？');
  await say(g, H_MOM, 'もう…ホテルのロビーで転ばないの！');
}

async function talkBiz(g, n) {
  const lines = ['東京から、新幹線と電車で出張です。\nなんばまで¥3,000、あっという間ですよ。'];
  if (g.state.fame >= 250) lines.push('…あれ？テレビで見たことあるような。\nあとで娘に自慢しよう。');
  lines.push('このホテル、朝のモーニングコールが\nとっても感じがいいんですよ。', '大阪は、ごはんがおいしくて困ります。\nとなりのたこ焼き、もう3回食べました。');
  await say(g, n, lines);
}

async function hotelBed(g) {
  if (g.flag('hotel_stay') !== g.state.day) {
    if (g.flag('hotel_slept') === g.state.day) { await g.say('ぐっすり眠れた！\nベッドメイクは、ホテルの人にお任せしよう。'); return; }
    await g.say('ふかふかのツインベッドだ。\n泊まるときは、1階のフロントで\nチェックインしよう。');
    return;
  }
  const i = await g.ask('ふかふかのツインベッドだ。\n眠る？（次の日になります）', ['眠る', 'まだ起きている']);
  if (i !== 0) return;
  g.setFlag('hotel_stay', 0);
  await g.sleep();
  g.setFlag('hotel_slept', g.state.day);
  await g.wait(300);
  g.sfx('chime'); await g.wait(250); g.sfx('chime');
  await g.say('プルルル…プルルル…\n部屋の電話が鳴っている。');
  await g.say(['おはようございます。フロントでございます。', 'モーニングコールのお時間です。\n本日も、なんばで素敵な一日を！'], { name: 'フロント（電話）', look: FRONT.look });
  g.facePlayer('down');
  await g.emote('player', '!');
  g.giveItem('onigiri');
  await g.say(['ドアの前に、朝食のおにぎりが届いていた！', `${g.state.day}日目の朝だ。\n体力もばっちり！今日もがんばろう！`]);
}

async function roomTv(g) {
  g.sfx('cursor');
  if (!today(g, 'hotel_tv_day')) {
    g.setFlag('hotel_tv_day', g.state.day);
    await g.say(['テレビをつけると、深夜のお笑い番組をやっていた。', 'ベテラン芸人さんの絶妙な間…\nメモメモ…勉強になる！']);
    const before = g.state.skills.warai;
    g.addSkill('warai', 1, true);
    if (g.state.skills.warai > before) { g.sfx('good'); await g.say('お笑いが1上がった！'); }
  } else {
    await g.say(['通販番組をやっている。', '「今ならもう1本ついてくる！」…\nそろそろ寝よう。']);
  }
}

function drawHotelLogo(ctx, sx, sy) {
  R(ctx, sx, sy + 1, 64, 13, '#c9a227');
  R(ctx, sx + 1, sy + 2, 62, 11, '#1d2a5e');
  text(ctx, 'DOT HOTEL', sx + 32, sy + 2, { size: 10, align: 'center', color: '#ffd23f', shadow: null });
  for (const x of [sx + 4, sx + 59]) { P(ctx, x, sy + 6, '#ffd23f'); P(ctx, x - 1, sy + 7, '#ffd23f'); P(ctx, x + 1, sy + 7, '#ffd23f'); P(ctx, x, sy + 8, '#ffd23f'); }
}

registerPlace({
  id: 'hotel',
  name: 'ドットホテル なんば',
  kind: 'building',
  bgm: 'office',
  start: { room: 'lobby', x: 8, y: 8, dir: 'up' },
  rooms: {
    // ------------------------------------------------------------ ロビー
    lobby: {
      floor: 'floor_marble',
      wall: 'wood',
      legend: {
        '=': 'hotel_wall', s: 'hotel_wall+hotel_sconce', C: 'hotel_wall+hotel_clocks', w: 'hotel_wall+window',
        D: 'hotel_door_l', d: 'hotel_door_r', E: 'elevator', Q: 'desk_pc', '|': 'hotel_counter_side',
        K: 'hotel_counter', b: 'hotel_counter_bell', A: 'hotel_podium', X: 'hotel_cart', P: 'plant',
        ',': 'hotel_carpet', V: 'hotel_carpet+tv', T: 'hotel_carpet+table_low', U: 'hotel_carpet+hotel_sofa_up', S: 'hotel_carpet+sofa_beige',
      },
      tiles: [
        '##################',
        '#=====sCsw=Dd=EEs#',
        '#Q....|.........P#',
        '#KKbKKK..A......X#',
        '#................#',
        '#,V,........,SSS,#',
        '#,T,........,,T,,#',
        '#UUU........,UUU,#',
        '#P..............P#',
        '########MM########',
      ],
      warps: [
        { x: 8, y: 9, to: 'exit' }, { x: 9, y: 9, to: 'exit' },
        ...[14, 15].map((x) => ({
          x, y: 1, room: 'room', tx: 5, ty: 6, dir: 'up', sfx: 'chime',
          check: async (g) => {
            if (g.flag('hotel_stay') === g.state.day) return true;
            await say(g, BELL, ['客室フロアへは、ルームキーが必要です。', 'ご宿泊は、フロントで承っております！']);
            return false;
          },
        })),
      ],
      entities: [
        { type: 'prop', x: 2, y: 1, w: 4, h: 1, solid: false, draw: drawHotelLogo },
        {
          type: 'prop', x: 11, y: 1, w: 2, h: 1, solid: false,
          draw(ctx, sx, sy) {
            R(ctx, sx, sy - 6, 32, 12, '#c9a227'); R(ctx, sx + 1, sy - 5, 30, 10, '#fff6dc');
            text(ctx, '宴会場', sx + 16, sy - 6, { size: 10, align: 'center', color: '#5a3420', shadow: null });
          },
        },
        {
          type: 'prop', x: 8, y: 5, w: 2, h: 1,
          text: ['ロビーの真ん中に、大きな生け花が飾られている。', '季節の花が、ふんわりいい香り。'],
          draw(ctx, sx, sy) {
            shadowEllipse(ctx, sx + 16, sy + 15, 12, 1);
            R(ctx, sx + 4, sy + 9, 24, 5, '#e8e4dc'); R(ctx, sx + 4, sy + 9, 24, 1, '#ffffff'); R(ctx, sx + 4, sy + 13, 24, 1, '#c3bfb6');
            R(ctx, sx + 14, sy + 14, 4, 2, '#8a6a4a');
            R(ctx, sx + 12, sy + 1, 8, 9, '#2a3a78'); R(ctx, sx + 13, sy + 2, 2, 7, '#4a5ab0');
            R(ctx, sx + 6, sy - 1, 6, 2, '#3f8a3a'); R(ctx, sx + 21, sy - 2, 6, 2, '#3f8a3a');
            disc(ctx, sx + 10, sy - 3, 3, '#ff7eb6'); disc(ctx, sx + 16, sy - 6, 3, '#ffd23f'); disc(ctx, sx + 22, sy - 3, 3, '#ff9a3c');
            disc(ctx, sx + 13, sy - 9, 2, '#ffffff'); disc(ctx, sx + 19, sy - 9, 2, '#ff7eb6');
            P(ctx, sx + 10, sy - 3, '#fff6a8'); P(ctx, sx + 16, sy - 6, '#ffffff'); P(ctx, sx + 22, sy - 3, '#fff6a8');
          },
        },
        npc('hotel_front', 3, 2, 'down', FRONT.look, FRONT.name, { talk: (g) => talkFront(g) }),
        npc('hotel_concierge', 9, 2, 'down', CONCIERGE.look, CONCIERGE.name, { talk: (g) => talkConcierge(g) }),
        npc('hotel_banquet', 12, 2, 'down', BANQUET.look, BANQUET.name, { talk: (g) => talkBanquet(g) }),
        npc('hotel_bell', 16, 4, 'left', BELL.look, BELL.name, {
          text: ['お荷物、お持ちしましょうか？\n…あ、手ぶらでしたか！', 'エレベーターは客室専用です。\nご宿泊は、フロントで承っております。'],
        }),
        npc('hotel_biz', 12, 6, 'right', BIZ.look, BIZ.name, { talk: talkBiz }),
        npc('hotel_mom', 4, 6, 'left', H_MOM.look, H_MOM.name, {
          text: ['家族で大阪旅行なの。\nあしたは、みんなで新喜劇を見に行くのよ。', 'ホテルに泊まると、朝ごはんのおにぎりが\nもらえるんですって。うれしいわね。'],
        }),
        npc('hotel_kid', 5, 4, 'down', H_KID.look, H_KID.name, { wander: 1, talk: talkHotelKid }),
      ],
      events: [
        {
          x: 2, y: 5, on: 'action',
          run: async (g) => {
            g.sfx('cursor');
            await g.say(['ロビーのテレビで、関西の情報番組をやっている。', HOTEL_TV[hotelTvIdx++ % HOTEL_TV.length]]);
          },
        },
        { x: 11, y: 1, w: 2, on: 'action', run: (g) => g.say(['宴会場の大きな扉だ。', '「本日 ドット商事さま 歓迎会」\nの札がかかっている。']) },
        { x: 7, y: 1, on: 'action', run: (g) => g.say('世界の時計が並んでいる。\n東京、ロンドン、ニューヨーク…。') },
        { x: 16, y: 3, on: 'action', run: (g) => g.say('金色のベルカートだ。\nスーツケースが積まれている。') },
        { x: 1, y: 7, w: 3, on: 'action', run: (g) => g.say('ふかふかのソファだ。\nテレビを見ながら、ひと休みできる。') },
        { x: 13, y: 5, w: 3, on: 'action', run: (g) => g.say('革ばりのソファだ。\n打ち合わせ中のビジネスマンが多い。') },
        { x: 13, y: 7, w: 3, on: 'action', run: (g) => g.say('ソファの上に、なんばの観光マップが置いてある。') },
      ],
      drawUnder(ctx, g, cam) {
        // gold ring emblem around the flower table
        const cx = 9 * TILE - cam.x, cy = 5 * TILE + 8 - cam.y;
        ctx.fillStyle = '#d8b04a';
        for (let a = 0; a < 360; a += 2) {
          const t = (a * Math.PI) / 180;
          ctx.fillRect(Math.round(cx + Math.cos(t) * 34), Math.round(cy + Math.sin(t) * 22), 2, 1);
          if (a % 6 === 0) ctx.fillRect(Math.round(cx + Math.cos(t) * 29), Math.round(cy + Math.sin(t) * 18), 1, 1);
        }
      },
    },

    // ------------------------------------------------------------ 客室
    room: {
      floor: 'floor_carpet_beige',
      wall: 'wood',
      bgm: 'night',
      entry: { x: 5, y: 6, dir: 'up' },
      legend: {
        '=': 'hotel_wall', Y: 'hotel_wall+hotel_win_l', W: 'hotel_wall+hotel_win_m', N: 'hotel_wall+hotel_win_n', Z: 'hotel_wall+hotel_win_r',
        F: 'hotel_wall+painting', c: 'hotel_wall+clock',
        n: 'hotel_lampstand', B: 'bed_top', b: 'bed_bottom', D: 'desk', V: 'tv', h: 'chair', S: 'hotel_suitcase', R: 'fridge',
      },
      tiles: [
        '############',
        '#=c=YWNZ=F=#',
        '#nBBn...DV.#',
        '#.bb....h..#',
        '#..........#',
        '#S.......R.#',
        '#..........#',
        '#####MM#####',
      ],
      warps: [
        { x: 5, y: 7, room: 'lobby', tx: 14, ty: 2, dir: 'down', sfx: 'chime' },
        { x: 6, y: 7, room: 'lobby', tx: 15, ty: 2, dir: 'down', sfx: 'chime' },
      ],
      entities: [
        npc('hotel_bell2', 6, 6, 'left', BELL.look, BELL.name, { cond: () => escorting, text: 'ごゆっくりどうぞ！' }),
      ],
      events: [
        { x: 2, y: 2, w: 2, h: 2, on: 'action', run: hotelBed },
        { x: 4, y: 1, w: 4, on: 'action', run: (g) => g.say(['窓の外に、なんばの夜景が広がっている。', '川沿いのネオンがきらきら…。\nいつか、あの看板に自分の顔が…！']) },
        { x: 9, y: 2, on: 'action', run: roomTv },
        { x: 8, y: 2, on: 'action', run: (g) => g.say('ホテルのメモ帳とペンが置いてある。\nネタのメモに、ちょうどいい。') },
        { x: 1, y: 2, on: 'action', run: (g) => g.say('ベッドサイドのランプだ。\nやわらかい光が、ほっとする。') },
        { x: 4, y: 2, on: 'action', run: (g) => g.say('ベッドサイドのランプ。\n目覚まし時計も置いてある。') },
        { x: 1, y: 5, on: 'action', run: (g) => g.say('{name}の旅行かばんだ。\n着替えと、ネタ帳が入っている。') },
        { x: 9, y: 5, on: 'action', run: (g) => g.say('小さな冷蔵庫だ。\n中は空っぽ…持ち込みはOKらしい。') },
      ],
    },
  },
});

// ====================================================================== たこ焼き屋 tiles
defineTile('takoyaki_floor', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#8e4a37');
    R(c, 0, 0, 7, 7, '#b8644a'); R(c, 8, 0, 8, 7, '#b05e45'); R(c, 0, 8, 7, 8, '#b05e45'); R(c, 8, 8, 8, 8, '#b8644a');
    R(c, 0, 0, 7, 1, '#c97a5e'); R(c, 8, 8, 8, 1, '#c97a5e');
  },
});
function takoCounter(c) {
  R(c, 0, 1, 16, 7, '#e2cfa8'); R(c, 0, 1, 16, 1, '#f2e2c0');
  R(c, 0, 8, 16, 8, '#8f6a48'); R(c, 0, 8, 16, 1, '#6e4f34'); R(c, 0, 15, 16, 1, '#5a3f28'); R(c, 3, 10, 10, 1, '#a07a56');
}
defineTile('takoyaki_plate', {
  solid: true, obj: true, talkThrough: true, frames: 4, speed: 10,
  draw(c, r, f) {
    takoCounter(c);
    R(c, 0, 1, 16, 7, '#2a2d36'); R(c, 0, 1, 16, 1, '#4a4e58'); R(c, 0, 7, 16, 1, '#1a1c22');
    R(c, 0, 8, 16, 1, '#d0551f');
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const x = 1 + col * 4, y = 2 + row * 3;
        const ph = (f + col + row * 2) % 4;
        const base = ph === 0 ? '#f0d48a' : ph === 1 ? '#e0a050' : '#c8782e';
        R(c, x, y, 3, 2, base); R(c, x, y + 2, 3, 1, shade(base, -0.3));
        P(c, x + (ph % 3), y, '#ffe8b0');
      }
    }
    if (f % 2) { P(c, 4 + f, 0, '#ffffff'); P(c, 11 - f, 0, '#e8eaee'); }
  },
});
defineTile('takoyaki_boats', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    takoCounter(c);
    for (const bx of [1, 9]) {
      R(c, bx, 4, 6, 3, '#d8b878'); R(c, bx, 6, 6, 1, '#a88850');
      for (let i = 0; i < 3; i++) R(c, bx + i * 2, 2, 2, 3, '#8a4a20');
      R(c, bx, 2, 6, 1, '#5a2a10');
      P(c, bx + 1, 3, '#ffffff'); P(c, bx + 3, 2, '#ffffff'); P(c, bx + 5, 3, '#ffffff');
      P(c, bx + 2, 3, '#5ee07a'); P(c, bx + 4, 3, '#5ee07a'); P(c, bx + 3, 1, '#ffb3a8');
    }
  },
});
defineTile('takoyaki_side', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 0, 10, 16, '#8f6a48'); R(c, 4, 0, 8, 14, '#e2cfa8'); R(c, 4, 0, 1, 14, '#f2e2c0');
    R(c, 3, 15, 10, 1, '#5a3f28');
  },
});
defineTile('takoyaki_prep', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 5, 16, 9, '#b8bec8'); R(c, 0, 5, 16, 1, '#e8eaee'); R(c, 1, 14, 2, 2, '#7d828c'); R(c, 13, 14, 2, 2, '#7d828c');
    R(c, 2, 1, 6, 5, '#dfe3ea'); R(c, 3, 2, 4, 2, '#f6e6b0');
    R(c, 9, 3, 5, 3, '#ffffff'); P(c, 10, 4, '#d65050'); P(c, 12, 4, '#d65050'); P(c, 11, 3, '#d65050');
    R(c, 3, 8, 10, 2, '#5fb36a'); R(c, 3, 8, 10, 1, '#8ad08f');
  },
});
defineTile('takoyaki_menu', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 1, 16, 1, '#5a3a20');
    for (let i = 0; i < 4; i++) {
      const x = 1 + i * 4;
      R(c, x, 2, 3, 10, '#e8d0a0'); R(c, x, 2, 3, 1, '#f6e6c0'); R(c, x, 11, 3, 1, '#c9a46a');
      for (let y = 4; y < 10; y += 2) P(c, x + 1, y, '#3a2512');
      P(c, x + 1, 10, '#d62f2f');
    }
  },
});
defineTile('takoyaki_table', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 5, 1);
    R(c, 7, 9, 2, 6, '#5a3a20'); R(c, 5, 14, 6, 1, '#3a2512');
    disc(c, 8, 5, 6, '#a8743f'); disc(c, 8, 5, 5, '#c99660');
    R(c, 4, 4, 6, 3, '#d8b878');
    for (let i = 0; i < 3; i++) R(c, 4 + i * 2, 3, 2, 2, '#8a4a20');
    R(c, 4, 3, 6, 1, '#5a2a10'); P(c, 5, 3, '#ffffff'); P(c, 8, 4, '#5ee07a');
    R(c, 11, 3, 1, 4, '#f2e2c0'); R(c, 11, 2, 1, 1, '#d62f2f');
  },
});
defineTile('takoyaki_aframe', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 5, 1);
    R(c, 3, 1, 10, 13, '#6e4428'); R(c, 4, 2, 8, 10, '#2a3a2e');
    R(c, 5, 3, 6, 1, '#ffffff'); R(c, 5, 5, 4, 1, '#ffe36e'); R(c, 5, 7, 5, 1, '#ffffff');
    disc(c, 9, 9, 1, '#c8782e'); R(c, 5, 9, 2, 1, '#ff9ac0');
    R(c, 3, 14, 2, 2, '#5a3a20'); R(c, 11, 14, 2, 2, '#5a3a20');
  },
});

// ====================================================================== たこ焼き屋 people & content
// the same name as in his talk menu (people.js)
const TAISHO = { name: 'たこ焼き屋の大将', look: { ...LOOKS.chef, hat: '#ffffff', top: '#2a3560', bottom: '#2a3560' } };
const SENPAI = { name: 'バイトの先輩', look: { hair: 'cap', hat: '#d62f2f', hairColor: 'brown', skin: 'fair', top: '#ff8a3d', bottom: '#3b3f48' } };
const T_OBACHAN = { name: '常連のおばちゃん', look: { ...LOOKS.oldwoman, hairColor: 'purple', top: '#d8a03a', bottom: '#5a4a3a' } };
const T_KAISHAIN = { name: '仕事帰りの会社員', look: { ...LOOKS.salaryman, tie: '#ff8a3d' } };
const T_STUDENT = { name: '部活帰りの高校生', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#2a3560', bottom: '#2a3560' } };
const T_TOURIST = { name: '東京から来た観光客', look: { ...LOOKS.tourist, hat: '#5fd7ff', top: '#ff7eb6' } };
const T_GEININ = { name: '劇場帰りの若手芸人', look: { ...LOOKS.comedian2, top: '#d62f2f' } };

const MATSURI_SCENES = [
  { prompt: '祭りの開会！最初のひとこと！', answers: [
    { text: 'みんな、盛り上がって〜！', score: 100 },
    { text: '本日は晴天なり', score: 40 },
    { text: '…マイク入ってる？', score: 20 },
  ] },
  { prompt: '大将「わしのたこ焼き、どや？」', answers: [
    { text: 'ふつうです', score: 0 },
    { text: '外カリ、中トロです！', score: 100 },
    { text: 'アツッ！アツッ！', score: 70 },
  ] },
  { prompt: 'こども「司会の人、だれ〜？」', answers: [
    { text: '通りすがりです', score: 30 },
    { text: 'ひみつ！', score: 50 },
    { text: '未来のスターやで！', score: 100 },
  ] },
  { prompt: '雨がぱらぱら…どうする！？', answers: [
    { text: '屋根の下で続行や！', score: 100 },
    { text: '解散〜！', score: 10 },
    { text: '雨もまた味です', score: 60 },
  ] },
];
const REPORT_SCENES = [
  { prompt: 'ディレクター「まずは、ひと口！」', answers: [
    { text: 'ハフハフ…うまっ！', score: 100 },
    { text: 'ふーふー…冷まします', score: 40 },
    { text: '熱いのでパスで', score: 0 },
  ] },
  { prompt: '「どんなお味ですか？」', answers: [
    { text: 'たこ焼きの味です', score: 10 },
    { text: 'だしの香りがふわっと！', score: 100 },
    { text: 'おいしいです', score: 40 },
  ] },
  { prompt: '大将「タコ、大きいやろ？」', answers: [
    { text: 'ふつうサイズですね', score: 0 },
    { text: 'タコ、どこ？', score: 50 },
    { text: 'タコが主役級です！', score: 100 },
  ] },
  { prompt: '「最後に、視聴者へひとこと！」', answers: [
    { text: 'なんばで待ってるで！', score: 100 },
    { text: '以上、現場からでした', score: 50 },
    { text: 'おなかいっぱいです', score: 30 },
  ] },
];
const TAKO_JOBS = {
  baito: {
    id: 'takoyaki_baito', title: 'たこ焼き焼きのバイト', client: TAISHO.name, clientLook: TAISHO.look,
    stamina: 20, minigame: 'rhythm', opts: { difficulty: 1, lanes: 1, song: 'くるくる！たこ焼き音頭' },
    pay: 900, fame: 3, skill: 'uta', gain: 1,
  },
  matsuri: {
    id: 'takoyaki_matsuri', title: '商店街の祭りの司会', client: TAISHO.name, clientLook: TAISHO.look,
    desc: 'なにわ商店街のお祭りを盛り上げよう！', stamina: 20,
    minigame: 'talk', opts: { difficulty: 2, topic: '商店街のお祭り', scenes: MATSURI_SCENES },
    pay: 4000, fame: 15, skill: 'talk', gain: 2, requires: TIER1,
  },
  report: {
    id: 'takoyaki_report', title: 'グルメ番組の食レポ', client: TAISHO.name, clientLook: TAISHO.look,
    desc: '関西のグルメ番組が、店に取材に来た！', stamina: 25,
    minigame: 'talk', opts: { difficulty: 3, topic: 'たこ焼きの食レポ', scenes: REPORT_SCENES },
    pay: 11000, fame: 40, skill: 'talk', gain: 3, requires: { fame: 250 },
  },
  cm: {
    id: 'takoyaki_cm', title: '商店街のテレビCM', client: TAISHO.name, clientLook: TAISHO.look,
    desc: 'CMソングを歌って、踊って、大阪を元気に！', stamina: 30,
    minigame: 'rhythm', opts: { difficulty: 4, lanes: 4, style: 'dance', song: 'なにわ商店街ソング' },
    pay: 55000, fame: 160, skill: 'uta', gain: 4, requires: { fame: 2000 },
  },
};

async function takoShop(g) {
  const goods = ['takoyaki', 'takoyaki_negi', 'takoyaki_ramune'];
  if (g.flag('takoyaki_star_done')) goods.push('takoyaki_star');
  const bought = await g.shop(goods, { title: 'たこ焼き屋', greeting: 'まいど！焼きたてやで〜！' });
  await say(g, TAISHO, bought ? 'おおきに！熱いうちに食べてや！\nやけどには気ぃつけてな。' : 'また寄ってってや〜！');
}

async function baito(g) {
  const job = TAKO_JOBS.baito;
  // burnout / starving: refuse before the kitchen scene (g.job would only refuse after it)
  const why = g.checkRequires(job.requires) || g.lifeRefusal();
  if (why) { await g.say(why); return; }
  const i = await ask(g, TAISHO, `手伝ってくれるんか？おおきに！\n「${job.title}」\nギャラ 目安¥900（出来で変動）／体力 -${job.stamina}・ストレス +${ACTIVITY.job.stress}`, ['やる！', 'やめておく']);
  if (i !== 0) return;
  if (g.state.stamina < job.stamina) {
    await say(g, TAISHO, ['顔色悪いで！\n体力が足りひんのとちゃうか？', 'たこ焼きでも食べて、休んでからおいで。']);
    return;
  }
  await g.fadeOut();
  g.placePlayer(6, 2, 'down');
  await g.fadeIn();
  if (!g.flag('takoyaki_baito_intro')) {
    g.setFlag('takoyaki_baito_intro');
    await g.moveNpc('takoyaki_senpai', 'face:left');
    await say(g, SENPAI, 'ほな、ウチがお手本見せたるわ！\nよう見ときや〜。');
    await g.moveNpc('takoyaki_senpai', 'face:down');
    for (let k = 0; k < 3; k++) { g.sfx('hit'); await g.emote('takoyaki_senpai', '♪', 22); }
    await say(g, SENPAI, 'くるっ、くるっ、くるっ！\nタン、タン、くるっ！や！');
    await say(g, TAISHO, ['コツは、リズムや！', '生地が焼けたら、テンポよく返す。\nそれだけで、外カリッ中トロッになるんや。']);
  } else {
    await say(g, TAISHO, 'ほな、今日も頼むで！\nお客さん、待っとるでえ！');
  }
  const res = await g.job({ ...job, confirm: false });
  await g.fadeOut();
  g.placePlayer(6, 4, 'up');
  await g.fadeIn();
  if (!res) return;
  if (res.rank === 'S' || res.rank === 'A') {
    await g.emote('takoyaki_taisho', '!');
    await say(g, TAISHO, '完璧や！外カリッ、中トロッ！\nええ腕しとるなあ！');
    if (res.rank === 'S') {
      g.giveItem('takoyaki');
      await say(g, TAISHO, 'まかないのたこ焼きや、持っていき！');
    }
  } else if (res.rank === 'B') {
    await say(g, TAISHO, 'まずまずやな！\nお客さんも喜んどったで。');
  } else {
    await say(g, TAISHO, 'ちょっと焦げてもうたなあ…。\nまあ、それも味や！また頼むで！');
  }
}

async function takoJob(g, job, after) {
  const res = await g.job(job);
  if (!res) return;
  if ('SAB'.includes(res.rank)) {
    g.sfx('applause');
    await say(g, TAISHO, after);
  } else {
    await say(g, TAISHO, 'おつかれさん！\n次は、もっとかましたってや！');
  }
}

// The スター焼き poster appears at the reveal (flag set together with the fanfare).
async function starEvent(g) {
  const p = g.map.player;
  await g.emote('takoyaki_taisho', '!');
  await say(g, TAISHO, ['おお、{name}！ちょうどええとこに来た！', 'ちょっと待っとき！']);
  await g.moveNpc('takoyaki_taisho', 'face:left');
  for (let k = 0; k < 3; k++) { g.sfx('hit'); await g.wait(220); }
  await g.emote('takoyaki_senpai', '♪');
  await g.moveNpc('takoyaki_taisho', 'face:down');
  await say(g, TAISHO, ['{name}の出世を祝うて、新メニューや！', '名付けて…「スター焼き」！\n金ごまキラッキラ、一番星の味やで！']);
  g.setFlag('takoyaki_star_done');
  g.sfx('fanfare');
  await g.emote('player', '!');
  const ob = g.npc('takoyaki_obachan');
  if (ob) {
    await g.walkNpcTo('takoyaki_obachan', p.x + 1, p.y, 1.5);
    g.npc('takoyaki_obachan').dir = 'left';
    await g.emote('takoyaki_obachan', '♥');
    await say(g, T_OBACHAN, 'あんた、ほんまに有名人になったんやなあ！\nおばちゃん、うれしいわあ！');
  }
  g.giveItem('takoyaki_star');
  await say(g, TAISHO, '第一号は、もちろんタダや！\nこれからは、店のメニューにも並ぶで！');
  if (ob) {
    const e = g.npc('takoyaki_obachan');
    await g.walkNpcTo('takoyaki_obachan', e.home.x, e.home.y);
    e.dir = 'left';
  }
}

async function taishoChat(g) {
  const lines = ['このあたりは、劇場帰りの芸人さんも\nよう来てくれるんや。'];
  if (!tier1(g)) lines.push('事務所に入るか、ちょっと名前が売れたら、\n商店街の祭りの司会を頼みたいんや。');
  else if (g.state.fame < 250) lines.push('もっと有名になったら、テレビの取材を\n一緒に受けてもらおかな！');
  else if (g.state.fame < 1000) lines.push('ほんまに売れっ子になったら、\n記念に何かしたろ思てるんや。お楽しみに！');
  else lines.push('「スター焼き」、よう売れとるで！\nあんたのおかげや。');
  lines.push('疲れたら、たこ焼き食べて元気出しや！\nとなりのホテルに泊まるのもええで。');
  await say(g, TAISHO, lines);
}

// Safety net for a player stuck in Osaka without money for the hotel: a nap in the back room
// (next day, but only 60 stamina so the hotel stays the better choice).
const canRestInBack = (g) => g.state.money < HOTEL_PRICE && g.state.stamina < 50;
async function restInBack(g) {
  await say(g, TAISHO, ['なんや、顔色悪いで。\n宿代もないんか？', 'ほな、店の奥の休憩室で寝ていき！\nせまいけど、ひと晩くらいなんとかなるやろ。']);
  const i = await ask(g, TAISHO, '休憩室で休ませてもらう？\n（次の日になります）', ['お願いします', 'だいじょうぶです']);
  if (i !== 0) { await say(g, TAISHO, 'さよか。無理したらあかんで！'); return; }
  await g.sleep({ save: false });
  g.state.stamina = Math.min(g.state.maxStamina, 60);
  g.save();
  await say(g, TAISHO, ['おはようさん！よう眠れたか？', '休憩室やと、疲れも半分くらいしか\nとれへんやろ。', 'しっかり稼いで、次はホテルに泊まるんやで！']);
}

async function talkTaisho(g, n) {
  if (g.state.fame >= 1000 && !g.flag('takoyaki_star_done')) await starEvent(g);
  const f = g.state.fame;
  const greet = f >= 1000 ? 'おっ、スターのお帰りや！\n今日は何にする？'
    : f >= 250 ? 'テレビ見たで！\nうちの常連さんが出とる言うて、自慢しとるんや。'
      : 'まいど！大阪名物、焼きたてやで！';
  const items = [
    { label: '買う', run: () => takoShop(g) },
    { label: 'バイトする', run: () => baito(g) },
  ];
  if (tier1(g)) items.push({ label: '祭りの司会', run: () => takoJob(g, TAKO_JOBS.matsuri, ['祭り、大成功や！', '商店街のみんなも「また頼みたい」言うとったで！']) });
  if (f >= 250) items.push({ label: '食レポのロケ', run: () => takoJob(g, TAKO_JOBS.report, ['放送見たお客さんで、行列ができとる！', 'あんたの食レポ、ほんまにうまそうやったで！']) });
  if (f >= 2000) items.push({ label: '商店街のCM', run: () => takoJob(g, TAKO_JOBS.cm, ['CMソング、子どもらがみんな歌うとるで！', '商店街のスターや！おおきに！']) });
  if (canRestInBack(g)) items.push({ label: '休ませてもらう', run: () => restInBack(g) });
  items.push({ label: '話を聞く', run: () => taishoChat(g) });
  items.push({ label: 'やめておく', run: null });
  await menu(g, n, greet, items);
}

async function talkObachan(g, n) {
  if (today(g, 'takoyaki_boke_day')) { await say(g, n, ['また明日も、おもろいこと聞かせてや〜！', '大阪ではな、ふられたら返す！\nこれ、基本やで。']); return; }
  await say(g, n, g.state.fame >= 250 ? 'あんた、テレビに出とった子やろ！？' : 'あら、見ん顔やね！\nあんた、もしかして芸人さん？');
  const i = await ask(g, n, 'ほな、なんかおもろいこと言うてみ！', ['タコだけに、タコ〜', 'たこ焼きの具は私です', '急に言われても…']);
  g.setFlag('takoyaki_boke_day', g.state.day);
  if (i === 0) {
    g.sfx('buzz');
    await g.emote(n.id, '…');
    await say(g, n, ['……。', 'さむっ！たこ焼きが冷めるわ！\nもっと気合い入れや〜！']);
  } else if (i === 1) {
    g.sfx('laugh');
    await g.emote(n.id, 'w');
    await say(g, n, ['なんでやねん！', 'あんたが入っとったら、\nたこ焼きデカすぎるわ！', '…でも今のは、ちょっとおもろかったで！']);
    g.addSkill('warai', 1);
  } else {
    await g.emote(n.id, '💢', 30);
    await say(g, n, ['そこは何か言わな！', '大阪ではな、ふられたら返すのが\n礼儀っちゅうもんや！']);
  }
}

const TAKO_TV = [
  '『新喜劇の舞台では、お約束のズッコケで\n客席が大爆笑！』',
  '『ツッコミは、ボケのあとすかさず！\nタイミングが命やで〜』',
  '『しゃべりの腕を磨くなら、\n劇場で場数をふむのが一番や！』',
];
let takoTvIdx = 0;

async function takoIntro(g) {
  if (!(await firstEnter(g, 'takoyaki_met'))) return;
  await g.emote('takoyaki_taisho', '!');
  await say(g, TAISHO, ['まいど！いらっしゃい！', '大阪名物たこ焼き、焼きたてやで〜！\n外はカリッ、中はトロッや！']);
  await g.emote('takoyaki_senpai', '♪');
  await say(g, SENPAI, 'バイトも募集中やで〜！\n大将に声かけてな！');
}

function drawTakoSign(ctx, sx, sy) {
  R(ctx, sx + 1, sy + 1, 62, 14, '#20232a');
  R(ctx, sx + 2, sy + 2, 60, 12, '#d62f2f');
  R(ctx, sx + 2, sy + 2, 60, 1, '#ff5d6c');
  text(ctx, 'たこ焼き', sx + 32, sy + 2, { size: 10, align: 'center', color: '#ffffff', outline: '#7a1520' });
  disc(ctx, sx + 7, sy + 8, 2, '#c8782e'); disc(ctx, sx + 56, sy + 8, 2, '#c8782e');
  P(ctx, sx + 6, sy + 7, '#ffe8b0'); P(ctx, sx + 55, sy + 7, '#ffe8b0');
}

registerPlace({
  id: 'takoyaki',
  name: 'たこ焼き屋',
  kind: 'building',
  bgm: 'osaka',
  start: { room: 'shop', x: 7, y: 8, dir: 'up' },
  rooms: {
    shop: {
      floor: 'takoyaki_floor',
      wall: 'wood',
      legend: {
        m: 'wall_wood+takoyaki_menu', L: 'wall_wood+lantern', T: 'wall_wood+tv_wall', c: 'wall_wood+clock',
        P: 'takoyaki_prep', '|': 'takoyaki_side', F: 'fridge_drinks', k: 'counter', G: 'takoyaki_plate', B: 'takoyaki_boats',
        A: 'takoyaki_aframe', t: 'takoyaki_table', b: 'bench', p: 'plant',
      },
      tiles: [
        '################',
        '#=mm=L====L=Tc=#',
        '#P.........|..F#',
        '#kGGGBGGGkkk...#',
        '#..............#',
        '#.............A#',
        '#..tt.....tt...#',
        '#..............#',
        '#p...........bb#',
        '#######MM#######',
      ],
      warps: [{ x: 7, y: 9, to: 'exit' }, { x: 8, y: 9, to: 'exit' }],
      entities: [
        { type: 'prop', x: 6, y: 1, w: 4, h: 1, solid: false, draw: drawTakoSign },
        {
          type: 'prop', x: 4, y: 1, w: 1, h: 1, solid: false, cond: (g) => !!g.flag('takoyaki_star_done'),
          draw(ctx, sx, sy, g) {
            R(ctx, sx + 4, sy + 2, 8, 11, '#ffd23f'); R(ctx, sx + 5, sy + 3, 6, 9, '#fff6a8');
            const tw = Math.floor(g.frame / 20) % 2;
            P(ctx, sx + 8, sy + 5, '#d62f2f'); P(ctx, sx + 7, sy + 6, '#d62f2f'); P(ctx, sx + 9, sy + 6, '#d62f2f'); P(ctx, sx + 8, sy + 7, '#d62f2f');
            if (tw) { P(ctx, sx + 3, sy + 1, '#ffffff'); P(ctx, sx + 12, sy + 11, '#ffffff'); }
          },
        },
        npc('takoyaki_taisho', 4, 2, 'down', TAISHO.look, TAISHO.name, { talk: talkTaisho, person: 'taisho' }),
        npc('takoyaki_senpai', 8, 2, 'down', SENPAI.look, SENPAI.name, {
          talk: async (g, n) => {
            await g.emote(n.id, '♪');
            const lines = ['たこ焼きを返すコツは、リズムや！\nタン、タン、くるっ！', 'バイトは大将に声かけてな。\n誰でも大歓迎やで！'];
            if (g.flag('takoyaki_baito_intro')) lines.push('あんたの返し、だいぶサマになってきたやん！');
            await say(g, n, lines);
          },
        }),
        npc('takoyaki_geinin', 13, 2, 'up', T_GEININ.look, T_GEININ.name, {
          talk: async (g, n) => {
            const lines = ['劇場の出番終わりは、ここって決めとるんや。\nソースの香りで、反省会や。'];
            if (!g.state.agency) lines.push('オーディションは、東京でも大阪でも受けられるで。\n松竹芸能の事務所も、すぐそこや。');
            else lines.push('{agency}所属かいな！\nほな、いつか同じ舞台に立とうや！');
            lines.push('新喜劇の舞台、いつか立ちたいなあ…。\nズッコケの稽古だけは、毎日しとるんやけど。');
            await say(g, n, lines);
          },
        }),
        npc('takoyaki_student', 2, 6, 'right', T_STUDENT.look, T_STUDENT.name, {
          text: ['部活のあとは、ねぎたこで決まりや！\nさっぱりして、なんぼでも入るで。', 'バイトの先輩、焼くのめっちゃ速いねん。\nくるくるくる〜って！'],
        }),
        npc('takoyaki_obachan', 5, 6, 'left', T_OBACHAN.look, T_OBACHAN.name, { talk: talkObachan }),
        npc('takoyaki_kaishain', 12, 6, 'left', T_KAISHAIN.look, T_KAISHAIN.name, {
          text: ['仕事帰りのたこ焼きが、いちばんのごほうびや。', '大将のたこ焼きは、だしが効いとるんよ。\nソースなしでも、いけるで。'],
        }),
        npc('takoyaki_tourist', 10, 5, 'down', T_TOURIST.look, T_TOURIST.name, {
          text: ['大阪の人って、ほんとに初対面でも\nツッコんでくれるんだね！', 'となりのホテルに泊まってるの。\n朝のおにぎりサービスがうれしいんだ〜。'],
        }),
      ],
      events: [
        {
          x: 12, y: 1, on: 'action',
          run: async (g) => {
            g.sfx('cursor');
            await g.say(['店のテレビで、関西のお笑い番組をやっている。', TAKO_TV[takoTvIdx++ % TAKO_TV.length]]);
          },
        },
        { x: 14, y: 2, on: 'action', run: (g) => g.say('ラムネが、キンキンに冷えている。\n買うときは、大将に声をかけよう。') },
        {
          x: 14, y: 5, on: 'action',
          run: (g) => g.say(['【本日のメニュー】', 'たこ焼き（8コ）¥400\nねぎたこ ¥550\nラムネ ¥150'].concat(g.flag('takoyaki_star_done') ? ['★スター焼き ¥800\n「{name}の出世を記念して！」'] : [])),
        },
        { x: 2, y: 3, w: 2, on: 'action', run: (g) => g.say('鉄板の上で、たこ焼きがジュウジュウ…。\nいいにおい！') },
        { x: 6, y: 3, w: 2, on: 'action', run: (g) => g.say('鉄板の上で、たこ焼きが\nくるくる回っている。') },
        { x: 5, y: 3, on: 'action', run: (g) => g.say('焼きたてのたこ焼きが、舟に盛られている。\nソースとマヨネーズの、いい香り！') },
        { x: 3, y: 6, w: 2, on: 'action', run: (g) => g.say('立ち食い用のテーブルだ。\nつまようじと、ソースのにおい。') },
        { x: 10, y: 6, w: 2, on: 'action', run: (g) => g.say('立ち食い用のテーブルだ。\n「熱いのでご注意を」と書いてある。') },
        { x: 13, y: 8, w: 2, on: 'action', run: (g) => g.say('持ち帰りのお客さん用のベンチだ。\n焼き上がりを待つ間に、ひと休み。') },
      ],
      onEnter: (g) => { if (!g.flag('takoyaki_met')) g.run(takoIntro); },
    },
  },
});
