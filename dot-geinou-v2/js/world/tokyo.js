// 東京エリア: the main town. Most agencies and TV stations are here.

import { registerPlace, PLACES } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { grid, set, put, fill, hroad, vroad, border, unstick, ekiEnter } from './townkit.js';
import { fountain, train, taxi, busStop, streetStage, statue } from './props.js';
import { text } from '../engine/draw.js';
export const TOKYO_W = 76; // x 60..75: the east block and the road to テレビ局エリア (minato.js)
export const TOKYO_H = 72; // rows 45..71: 芸人通り and the 劇場通り, south of よしもと's block (added later; rows 0..44 kept as before)
export const TOKYO_GATE_Y = 45; // the ネオン街 gate at the foot of the centre avenue (kanraku.js arrives on row 44)
// [R9-A] 東京駅: its door leads into the rail network's 駅構内 (place 'eki', room 'tokyo') once that exists
// (before: station_tokyo, the 新幹線 hall). A train arrival appears in front of the door.
const STATION = { x: 44, y: 26, w: 12, h: 5, door: 6 };
export const EKI = { x: STATION.x + STATION.door, y: STATION.y + STATION.h, dir: 'down' };

// The landlady's talk and the apartment upgrades live in home.js, which puts the
// talk on its place definition. Looked up when she is spoken to (no import), so a
// broken home.js or title.js cannot take the whole town down with it.
async function oyaTalk(g, npc) {
  const talk = PLACES.home && PLACES.home.oyaTalk;
  if (talk) { await talk(g, npc); return; }
  await g.say(['あら{name}ちゃん、おでかけ？', '疲れたら部屋のベッドでゆっくり休むのよ。'], { name: npc.name, look: npc.look });
}

// Street performance in the park: available to everyone, small reward.
async function streetLive(g) {
  const kinds = [
    { minigame: 'tsukkomi', skill: 'warai', title: '路上漫才' },
    { minigame: 'rhythm', skill: 'uta', title: '路上ライブ（歌）' },
  ];
  const i = await g.ask('公園の小さなステージだ。ここでパフォーマンスをすれば、投げ銭がもらえるかも？', ['漫才をする', '歌をうたう', 'やめておく']);
  if (i > 1 || i < 0) return;
  const k = kinds[i];
  await g.job({ id: 'street_' + k.minigame, title: k.title, stamina: 10, minigame: k.minigame, opts: { difficulty: 1 }, pay: 600, fame: 4, skill: k.skill, gain: 1, confirm: false });
}

// The bus stops (by the station, and in the east plaza): buses to ドット商店街 and
// テレビ局エリア (machi.js / minato.js have the buses back).
async function busToMachi(g) {
  const dests = [];
  if (PLACES.machi) dests.push({ label: 'ドット商店街', place: 'machi', x: 38, y: 20, flag: 'machi_intro', walk: '大通りを西へまっすぐ' });
  if (PLACES.minato) dests.push({ label: 'テレビ局エリア', place: 'minato', x: 35, y: 28, flag: 'minato_intro', walk: '大通りを東へまっすぐ' });
  if (PLACES.nagatacho) dests.push({ label: '永田町・霞が関', place: 'nagatacho', x: 45, y: 51, flag: 'nagatacho_intro', walk: 'まん中の通りを北へまっすぐ' });
  if (PLACES.kanraku) dests.push({ label: 'ネオン街', place: 'kanraku', x: 35, y: 9, flag: 'kanraku_intro', walk: 'まん中の通りを南へまっすぐ' });
  if (!dests.length) { await g.say('バス停だ。時刻表を見ると…次のバスはしばらく来ないみたい。'); return; }
  const i = await g.ask('バス停だ。\nどこ行きのバスに乗る？（¥210）', [...dests.map((d) => d.label), 'やめておく'], { cancel: dests.length });
  if (i < 0 || i >= dests.length) return;
  const d = dests[i];
  if (!g.spend(210)) { await g.say(`運賃が足りない…。\n歩いていこう。（${d.walk}）`); return; }
  g.sfx('coin');
  const first = !g.flag(d.flag); // the town's first-visit lines describe the arrival
  await g.fadeOut(16);
  g.sfx('door');
  await g.wait(600);
  await g.goto(d.place, 'main', d.x, d.y, 'down');
  if (!first) await g.say(`ブロロロ…。\n${d.label}でバスを降りた。`);
}

// Signpost by the east exit: 「テレビ局エリア →」.
function minatoSignpost(x, y) {
  const F = (ctx, x0, y0, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x0, y0, w, h); };
  return {
    type: 'prop', x, y, w: 1, h: 1,
    text: ['道しるべだ。', 'テレビ局エリア →\n（日本テレビ・TBS・テレビ朝日・フジテレビ・テレビ東京）\nこの大通りを東へまっすぐ。', '東京駅前のバス停からは、\nテレビ局エリア行きのバスも出ている。（¥210）'],
    draw(ctx, sx, sy) {
      F(ctx, sx + 3, sy + 14.5, 10, 1.5, 'rgba(0,0,0,0.22)');
      F(ctx, sx + 6.5, sy - 4, 2.5, 19, '#4a2e18'); F(ctx, sx + 7, sy - 4, 1, 19, '#8a5a33');
      // arrow board pointing east
      F(ctx, sx - 13.5, sy - 9.5, 28, 9, '#3a2512');
      for (let k = 0; k < 4; k++) F(ctx, sx + 14.5 - k, sy - 5.5 - k, 1, 1 + k * 2, '#3a2512');
      F(ctx, sx - 13, sy - 9, 27, 8, '#c48a52'); F(ctx, sx - 13, sy - 9, 27, 1, '#e0b07a');
      for (let k = 0; k < 4; k++) F(ctx, sx + 14 - k, sy - 5 - k + 0.5, 1, k * 2, '#c48a52');
      F(ctx, sx - 13, sy - 1.5, 27, 0.5, '#8a5a33');
      text(ctx, 'テレビ局エリア', sx + 0.5, sy - 7.5, { size: 4, align: 'center', color: '#fff6e0', shadow: '#3a2512' });
    },
  };
}

// Signpost by the north exit: 「↑ 永田町・霞が関」 (an arrow board pointing up).
function nagatachoSignpost(x, y) {
  const F = (ctx, x0, y0, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x0, y0, w, h); };
  return {
    type: 'prop', x, y, w: 1, h: 1,
    text: ['道しるべだ。', '↑ 永田町・霞が関\n（国会議事堂・首相官邸・政党の本部・官庁街）\nこのまん中の通りを北へまっすぐ。', '東京駅前のバス停からは、\n永田町行きのバスも出ている。（¥210）'],
    draw(ctx, sx, sy) {
      F(ctx, sx + 3, sy + 14.5, 10, 1.5, 'rgba(0,0,0,0.22)');
      F(ctx, sx + 6.5, sy - 4, 2.5, 19, '#4a2e18'); F(ctx, sx + 7, sy - 4, 1, 19, '#8a5a33');
      F(ctx, sx - 15.5, sy - 10.5, 31, 10, '#3a2512');
      F(ctx, sx - 15, sy - 10, 30, 9, '#c48a52'); F(ctx, sx - 15, sy - 10, 30, 1, '#e0b07a');
      F(ctx, sx - 15, sy - 2, 30, 0.5, '#8a5a33');
      text(ctx, '↑永田町', sx, sy - 8.5, { size: 5, align: 'center', color: '#fff6e0', shadow: '#3a2512' });
    },
  };
}

// Signpost by the west exit: 「← ドット商店街」 (a wooden arrow board on a post).
function machiSignpost(x, y) {
  const F = (ctx, x0, y0, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x0, y0, w, h); };
  return {
    type: 'prop', x, y, w: 1, h: 1,
    text: ['道しるべだ。', '← ドット商店街\n（スーパー・カフェ・ジム・カラオケ・不動産屋 など）\nこの大通りを西へまっすぐ。', '東京駅前のバス停からは、\n商店街行きのバスも出ている。（¥210）'],
    draw(ctx, sx, sy) {
      F(ctx, sx + 3, sy + 14.5, 10, 1.5, 'rgba(0,0,0,0.22)');
      F(ctx, sx + 7, sy - 4, 2.5, 19, '#4a2e18'); F(ctx, sx + 7.5, sy - 4, 1, 19, '#8a5a33');
      // arrow board pointing west (outline, wood, light edge)
      F(ctx, sx - 6.5, sy - 9.5, 28, 9, '#3a2512');
      for (let k = 0; k < 4; k++) F(ctx, sx - 10.5 + k, sy - 5.5 - k, 1, 1 + k * 2, '#3a2512');
      F(ctx, sx - 6, sy - 9, 27, 8, '#c48a52'); F(ctx, sx - 6, sy - 9, 27, 1, '#e0b07a');
      for (let k = 0; k < 4; k++) F(ctx, sx - 10 + k, sy - 5 - k + 0.5, 1, k * 2, '#c48a52');
      F(ctx, sx - 6, sy - 1.5, 27, 0.5, '#8a5a33');
      text(ctx, 'ドット商店街', sx + 7, sy - 7.5, { size: 4, align: 'center', color: '#fff6e0', shadow: '#3a2512' });
    },
  };
}

// Signpost by the south exit: 「↓ ネオン街」 (kanraku.js; an arrow board pointing down).
function kanrakuSignpost(x, y) {
  const F = (ctx, x0, y0, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x0, y0, w, h); };
  return {
    type: 'prop', x, y, w: 1, h: 1,
    text: ['道しるべだ。', '↓ ネオン街\n（居酒屋・ゲームセンター・カプセルホテル・交番 など）\nこのまん中の通りを南へまっすぐ。', '夜の繁華街だ。客引きや「うまい話」には気をつけよう。\n東京駅前のバス停からは、ネオン街行きのバスも出ている。（¥210）'],
    draw(ctx, sx, sy) {
      F(ctx, sx + 3, sy + 14.5, 10, 1.5, 'rgba(0,0,0,0.22)');
      F(ctx, sx + 6.5, sy - 4, 2.5, 19, '#4a2e18'); F(ctx, sx + 7, sy - 4, 1, 19, '#8a5a33');
      F(ctx, sx - 15.5, sy - 10.5, 31, 10, '#3a2512');
      F(ctx, sx - 15, sy - 10, 30, 9, '#c48a52'); F(ctx, sx - 15, sy - 10, 30, 1, '#e0b07a');
      F(ctx, sx - 15, sy - 2, 30, 0.5, '#8a5a33');
      text(ctx, '↓ネオン街', sx, sy - 8.5, { size: 5, align: 'center', color: '#fff6e0', shadow: '#3a2512' });
    },
  };
}

// ---------------------------------------------------------------- 芸人通り (rows 44..71)
// South of よしもと's block: a lane along row 44, the ネオン街 gate at the foot of the centre
// avenue (row 45, x 38..42), then two streets. The brick 芸人通り (rows 51..55) has NSC東京校
// (from 1995), the 貸し稽古場 and small studios on its north side; the car road 劇場通り
// (rows 65..69) has a 小劇場, a live house, a 演芸場 and the ネタ広場 (a pocket park).
// The west avenue (x 19..21) runs down through both.

// The game year (NSC東京校 opened in 1995).
function yearOf(g) {
  try { if (typeof g.owaraiDate === 'function') return g.owaraiDate().year; } catch (e) { console.error(e); }
  return g.state && g.state.profile && g.state.profile.era === 'showa' ? 1987 : 2026;
}
const nscTokyoOpen = (g) => yearOf(g) >= 1995;

// The neon gate over the centre avenue (x .. x+6, one row): pillars at both ends (solid
// signs), the arch drawn above the row. Walking under it leads to ネオン街 (kanraku.js).
function neonGateSouth(x, y) {
  const F = (ctx, x0, y0, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x0, y0, w, h); };
  return {
    // z: drawn under anyone standing on the avenue rows above (the player arriving from ネオン街
    // stands right behind it on row 44 and must stay in sight)
    type: 'prop', x, y, w: 7, h: 1, solid: false, z: -100,
    draw(ctx, sx, sy, g) {
      const t = (g && g.frame) || 0;
      // light spilling out of the street beyond
      ctx.globalAlpha = 0.16; F(ctx, sx + 14, sy + 1, 84, 14, '#ff4f8b'); ctx.globalAlpha = 1;
      for (const px of [sx + 3, sx + 99]) {
        F(ctx, px, sy - 30, 10, 44, '#1a1820');
        F(ctx, px + 0.5, sy - 30, 9, 43.5, '#2a2632'); F(ctx, px + 1, sy - 30, 2, 43, '#4a4456');
        F(ctx, px - 1, sy + 10, 12, 5, '#3a3642'); F(ctx, px - 1, sy + 10, 12, 1, '#5a5464');
        for (let k = 0; k < 4; k++) F(ctx, px + 3.5, sy - 24 + k * 8, 3, 3, (Math.floor(t / 10) + k) % 2 ? '#ffe9a0' : '#c8a050');
      }
      F(ctx, sx, sy - 41, 112, 20, '#20232a');
      F(ctx, sx + 1, sy - 40, 110, 18, '#3a1030');
      F(ctx, sx + 2, sy - 39, 108, 16, '#c8143c');
      F(ctx, sx + 2, sy - 39, 108, 1.5, '#ff5a7a'); F(ctx, sx + 2, sy - 24.5, 108, 1.5, '#8a0a24');
      const k = Math.floor(t / 6) % 3;
      for (let i = 0; i < 36; i++) {
        F(ctx, sx + 3.5 + i * 3, sy - 40.5, 1, 1, (i + k) % 3 ? '#fff3a0' : '#7a6a3a');
        F(ctx, sx + 3.5 + i * 3, sy - 22.5, 1, 1, (i + k + 1) % 3 ? '#fff3a0' : '#7a6a3a');
      }
      text(ctx, 'ネオン街', sx + 56, sy - 37, { size: 12, align: 'center', color: '#fff6c8', shadow: '#5a0018' });
    },
  };
}

// Signpost at the corner of the west avenue: 「↓ 芸人通り」.
function geininSignpost(x, y) {
  const F = (ctx, x0, y0, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x0, y0, w, h); };
  return {
    type: 'prop', x, y, w: 1, h: 1,
    talk: async (g) => g.say(['道しるべだ。', `↓ 芸人通り\n（${nscTokyoOpen(g) ? 'NSC東京校・' : ''}貸し稽古場・スタジオ）\nこの西の通りを南へすぐ。`, 'その先の「劇場通り」には、\n小劇場・ライブハウス・演芸場がある。']),
    draw(ctx, sx, sy) {
      F(ctx, sx + 3, sy + 14.5, 10, 1.5, 'rgba(0,0,0,0.22)');
      F(ctx, sx + 6.5, sy - 4, 2.5, 19, '#4a2e18'); F(ctx, sx + 7, sy - 4, 1, 19, '#8a5a33');
      F(ctx, sx - 15.5, sy - 10.5, 31, 10, '#3a2512');
      F(ctx, sx - 15, sy - 10, 30, 9, '#c48a52'); F(ctx, sx - 15, sy - 10, 30, 1, '#e0b07a');
      F(ctx, sx - 15, sy - 2, 30, 0.5, '#8a5a33');
      text(ctx, '↓芸人通り', sx, sy - 8.5, { size: 5, align: 'center', color: '#fff6e0', shadow: '#3a2512' });
    },
  };
}

function districtTiles(c, W) {
  // the lane between the old blocks and the new ones (the avenues cross it)
  for (let x = 1; x <= W - 2; x++) if (!(x >= 18 && x <= 22) && !(x >= 38 && x <= 42)) set(c, x, 44, 'sidewalk');
  // ---- north row (rows 45..50): backyards with hedges, alleys down to 芸人通り
  fill(c, 1, 45, 17, 6, 'grass');
  for (let x = 1; x <= 16; x++) if (x !== 9 && x !== 10) put(c, x, 45, 'hedge');
  fill(c, 9, 45, 2, 6, 'path'); fill(c, 17, 44, 1, 7, 'path');
  put(c, 1, 47, 'bush'); put(c, 1, 50, 'bicycle');
  fill(c, 23, 45, 10, 6, 'stone');                     // NSC東京校's lot
  fill(c, 33, 45, 4, 6, 'brick');                      // the alley by the gate
  put(c, 36, 46, 'vending'); put(c, 36, 47, 'trash'); put(c, 33, 49, 'bicycle');
  fill(c, 37, 46, 7, 5, 'sidewalk');                   // カラオケ
  fill(c, 44, 45, 2, 6, 'path');
  fill(c, 46, 45, 19, 6, 'grass');
  for (let x = 46; x <= 64; x++) put(c, x, 45, 'hedge');
  fill(c, 65, 45, 2, 6, 'path');
  fill(c, 67, 45, 8, 6, 'grass');
  for (let x = 67; x <= 74; x++) put(c, x, 45, 'hedge');
  put(c, 74, 47, 'tree'); put(c, 74, 50, 'planter');
  for (const x of [51, 58]) { put(c, x, 50, 'nobori'); put(c, x, 47, 'bush'); }
  // ---- 芸人通り (rows 51..55), brick, with lamps and planters on its south edge
  fill(c, 1, 51, W - 2, 5, 'brick');
  for (const x of [4, 12, 26, 34, 46, 54, 62, 70]) put(c, x, 55, 'lamp');
  for (const x of [8, 30, 50, 66]) put(c, x, 55, 'planter');
  put(c, 58, 55, 'bench'); put(c, 1, 55, 'vending');
  put(c, 17, 55, 'sign_board');
  // ---- south block (rows 56..64): backs of the 劇場通り buildings, the ネタ広場
  fill(c, 1, 56, W - 2, 9, 'grass');
  for (let x = 1; x <= W - 2; x++) if (![11, 17, 32, 39, 40, 41, 44, 62].includes(x) && !(x >= 18 && x <= 22)) put(c, x, 56, 'hedge');
  for (const x of [11, 32, 44, 62]) fill(c, x, 56, 1, 9, 'path');
  fill(c, 23, 57, 14, 8, 'stone');
  put(c, 1, 58, 'tree'); put(c, 13, 58, 'tree'); put(c, 15, 58, 'sakura'); put(c, 17, 60, 'tree');
  put(c, 24, 57, 'planter'); put(c, 34, 58, 'tree'); put(c, 36, 58, 'planter');
  put(c, 48, 58, 'tree'); put(c, 46, 59, 'sakura'); put(c, 50, 59, 'tree');
  put(c, 65, 58, 'tree'); put(c, 67, 59, 'sakura');
  for (const [x, y] of [[70, 58], [73, 60], [69, 62], [74, 63]]) put(c, x, y, (x + y) % 2 ? 'sakura' : 'tree');
  for (const [x, y] of [[71, 60], [72, 63], [68, 58]]) set(c, x, y, 'flowers');
  put(c, 71, 64, 'vending'); put(c, 72, 64, 'trash');
  // ネタ広場: grass, a path through the middle, trees and benches
  fill(c, 39, 56, 3, 9, 'path');
  for (const [x, y] of [[37, 56], [43, 56], [43, 60], [37, 64]]) put(c, x, y, 'tree');
  put(c, 43, 64, 'sakura');
  for (const [x, y] of [[38, 63], [42, 63], [38, 56]]) set(c, x, y, 'flowers');
  put(c, 37, 61, 'bench'); put(c, 42, 57, 'bench');
  // ---- 劇場通り: the car road (rows 65..69) and a row of trees along the south edge
  hroad(c, 66, 1, W - 2);
  for (let x = 1; x <= W - 2; x++) if (x % 3 === 1 && (x < 28 || x > 32)) put(c, x, 70, 'tree');
  for (const x of [6, 14, 26, 36, 48, 58, 68]) put(c, x, 69, 'lamp');
}

function districtEntities() {
  const nscOpen = (g) => nscTokyoOpen(g);
  const before = (g) => !nscTokyoOpen(g);
  return [
    // north row (doors on row 50, fronts on 芸人通り)
    { type: 'building', x: 2, y: 46, w: 7, h: 5, door: 3, name: '純喫茶 ドット', kind: 'cafe', wall: '#efe3d0', roof: '#5b3a29', sign: { text: '純喫茶 ドット', bg: '#5b3a29', color: '#fff3e0' },
      text: ['昔ながらの喫茶店だ。', 'テーブルにノートを広げて、ネタを書いている若者が何人もいる。\nコーヒー一杯で何時間もねばれる店らしい。'] },
    { type: 'building', x: 11, y: 46, w: 6, h: 5, door: 3, name: '古着屋', kind: 'boutique', wall: '#f2ece0', roof: '#3b3f48', sign: { text: '古着', bg: '#20232a', color: '#f4e6cc' },
      text: ['古着屋だ。', '派手なジャケットに、ド派手なシャツ…。\n衣装をさがしに来る芸人も多いらしい。'] },
    ...(PLACES.nsc_tokyo ? [{ type: 'building', x: 23, y: 45, w: 10, h: 6, door: 5, place: 'nsc_tokyo', name: 'NSC東京校', kind: 'office', wall: '#fff3e6', roof: '#e8492a', canopy: '#e8492a', sign: { text: 'NSC東京校', bg: '#e8492a', color: '#ffffff' }, cond: nscOpen }] : []),
    { type: 'building', x: 23, y: 45, w: 10, h: 6, door: 5, name: 'テナント募集中のビル', kind: 'office', wall: '#e4e2dc', roof: '#7a7f8a', sign: { text: 'テナント募集', bg: '#ffffff', color: '#d62f2f' },
      cond: PLACES.nsc_tokyo ? before : undefined, text: ['まだ新しいビルだ。', '「テナント募集」の貼り紙がある。\n一階から三階まで、まるごと空いているらしい。'] },
    { type: 'building', x: 37, y: 46, w: 7, h: 5, door: 3, name: 'カラオケ', kind: 'karaoke', sign: { text: 'カラオケ', bg: '#20232a', color: '#ff7eb6' },
      text: ['カラオケ店だ。', '個室を借りて、ネタ合わせをする芸人も多いらしい。\n大きな声を出しても、だれにも気づかれない。'] },
    { type: 'building', x: 46, y: 46, w: 5, h: 5, door: 2, name: 'リハーサルスタジオ', kind: 'studio', wall: '#d8d2c4', roof: '#5a6070', onair: false, sign: { text: 'スタジオ', bg: '#ffffff', color: '#20232a' },
      text: ['時間貸しのリハーサルスタジオだ。', 'バンドやダンサー、芸人も使っているらしい。\n今日は予約でいっぱいだ。'] },
    ...(PLACES.keikoba ? [{ type: 'building', x: 52, y: 46, w: 6, h: 5, door: 3, place: 'keikoba', name: '貸し稽古場 ドットスタジオ', kind: 'office', wall: '#efe2bf', roof: '#5a4a3a', sign: { text: '稽古場', bg: '#3b2a1a', color: '#ffd23f' } }] : []),
    { type: 'building', x: 59, y: 46, w: 6, h: 5, door: 3, name: 'ダンススタジオ', kind: 'gym', accent: '#ff7eb6', sign: { text: 'ダンス', bg: '#20232a', color: '#ff7eb6' },
      text: ['ダンススタジオだ。', '鏡の前で、何人もがステップの練習をしている。'] },
    { type: 'building', x: 67, y: 46, w: 7, h: 5, door: 3, name: 'ひなた荘', kind: 'house', wall: '#e8dcc0', roof: '#6a4a33', sign: { text: 'ひなた荘', bg: '#fff6e0' },
      text: ['古い木造アパートだ。', '家賃が安いので、芸人の卵がたくさん住んでいるらしい。\n夜中までネタ合わせの声が聞こえるとか…。'] },
    // the gate to ネオン街, its pillars
    ...(PLACES.kanraku ? [
      neonGateSouth(37, TOKYO_GATE_Y),
      { type: 'sign', x: 37, y: TOKYO_GATE_Y, solid: true, text: ['「ネオン街」の入口のゲートだ。', 'ゲートをくぐると、夜の繁華街。\n居酒屋・ゲームセンター・カプセルホテル…。'] },
      { type: 'sign', x: 43, y: TOKYO_GATE_Y, solid: true, text: ['ゲートの柱に、貼り紙がある。', '「客引き行為は条例で禁止されています」'] },
    ] : []),
    geininSignpost(17, 43),
    { type: 'sign', x: 17, y: 55, solid: true, talk: async (g) => g.say(['「芸人通り」の案内板だ。', `北：喫茶店・古着屋・${nscTokyoOpen(g) ? 'NSC東京校・' : ''}カラオケ・\nスタジオ・貸し稽古場・ダンススタジオ・アパート`, '南の「劇場通り」：小劇場・カフェ・ライブハウス・\n古本屋・ネタ広場・ラーメン屋・演芸場']) },
    // 劇場通り (doors on row 64, fronts on the car road's sidewalk)
    { type: 'building', x: 2, y: 58, w: 9, h: 7, door: 4, name: 'ドット小劇場', kind: 'theater', wall: '#ece4d2', roof: '#5a2a6a', sign: { text: 'ドット小劇場', bg: '#20232a', color: '#ffd23f' },
      text: ['客席六十ほどの、小さな劇場だ。', '入口に、手書きのチラシがびっしり貼ってある。\n今夜は若手のお笑いライブらしい。'] },
    { type: 'building', x: 12, y: 60, w: 5, h: 5, door: 2, name: 'カフェ', kind: 'cafe', wall: '#f3eadb', roof: '#2f6a4a', sign: { text: 'カフェ', bg: '#2f6a4a', color: '#ffffff' },
      text: ['小さなカフェだ。', '台本を読みあわせている二人組がいる。'] },
    { type: 'building', x: 24, y: 59, w: 8, h: 6, door: 4, name: 'ライブハウス', kind: 'karaoke', wall: '#2a2d36', roof: '#20232a', neon: '#5fd7ff', sign: { text: 'ライブハウス', bg: '#20232a', color: '#5fd7ff' },
      text: ['地下にあるライブハウスだ。', '今夜の出演者の名前が、黒板に書いてある。\nバンドの日もあれば、お笑いライブの日もあるらしい。'] },
    { type: 'building', x: 33, y: 61, w: 4, h: 4, door: 2, name: '古本屋', kind: 'bookstore', sign: { text: '古本', bg: '#ffffff', color: '#2a3a7a' },
      text: ['古本屋だ。', '店先のワゴンに、昔の演芸雑誌が並んでいる。'] },
    { type: 'building', x: 45, y: 61, w: 6, h: 4, door: 3, name: 'ラーメン屋', kind: 'ramen', sign: { text: 'ラーメン', bg: '#d62f2f', color: '#ffffff' },
      text: ['ラーメン屋だ。', '「芸人さん大盛り無料」の貼り紙がある。\n…売れていない芸人のための店らしい。'] },
    { type: 'building', x: 52, y: 58, w: 10, h: 7, door: 5, name: 'ドット演芸場', kind: 'theater', wall: '#f2e6cc', roof: '#2a3a5a', sign: { text: 'ドット演芸場', bg: '#ffffff', color: '#2a3a5a' },
      text: ['演芸場だ。', '漫才、落語、コント、マジック…。\n昼から夜まで、毎日だれかが高座に上がっている。'] },
    { type: 'building', x: 63, y: 61, w: 5, h: 4, door: 2, name: 'コーヒースタンド', kind: 'coffee', wall: '#efe3d0', roof: '#8a5a33', sign: { text: 'コーヒー', bg: '#8a5a33', color: '#fff3e0' },
      text: ['コーヒースタンドだ。', 'いい香りがする。'] },
    busStop(30, 69, { text: undefined, talk: busToMachi }),

    // people of the district (passers-by; nobody here is a registered person)
    { type: 'npc', id: 'gd_writer', x: 6, y: 52, dir: 'down', look: { ...LOOKS.comedian2, top: '#5a6f8a' }, name: 'ネタを書く若者', wander: 2,
      text: ['あの喫茶店でネタを書くのが日課なんだ。', 'コーヒー一杯で三時間。\n…マスターの目が、ちょっとこわい。'] },
    { type: 'npc', id: 'gd_nsc', x: 27, y: 53, dir: 'down', look: { ...LOOKS.comedian, top: '#e8492a', hairColor: 'black' }, name: 'NSC生', cond: nscOpen,
      text: ['NSCの授業、今日はネタ見せだったんです。', '講師の先生に「三分もいらん、一分で笑わせろ」って\n言われちゃって…。', '同期がたくさんいるから、顔と名前を\n覚えてもらうだけでもたいへんなんですよ。'] },
    { type: 'npc', id: 'gd_hopeful', x: 27, y: 53, dir: 'down', look: { ...LOOKS.comedian, top: '#2f6fd0', hairColor: 'black' }, name: '芸人志望の若者', cond: before,
      text: ['よしもとの事務所が近いから、\nこのへんには芸人志望が多いんだ。', 'みんな、劇場の前座やライブのオーディションで\nちょっとずつ舞台に立ってるよ。'] },
    { type: 'npc', id: 'gd_boke', x: 37, y: 58, dir: 'right', look: { ...LOOKS.comedian, top: '#ff8a3d', hairColor: 'brown' }, name: 'ネタ合わせ中の芸人', fixedDir: true,
      text: ['…でな、そのとき俺が言うたんや。', '（ネタ合わせの最中みたいだ）'] },
    { type: 'npc', id: 'gd_tsukkomi', x: 38, y: 58, dir: 'left', look: { ...LOOKS.comedian2, top: '#2f9a4a' }, name: 'ネタ合わせ中の芸人', fixedDir: true,
      text: ['なんでやねん！…あ、すいません。いま練習中で。', '来週、そこの小劇場のライブに出るんです。\nよかったら見に来てください。'] },
    { type: 'npc', id: 'gd_tree', x: 42, y: 60, dir: 'right', look: { ...LOOKS.salaryman, top: '#8a5ac8' }, name: '木に話しかける人', fixedDir: true,
      text: ['（木に向かって、ひとりでしゃべっている…）', '…あっ、見てました？\n木をお客さんだと思って、ネタの練習してたんです。', '木は笑わないけど、帰りもしないから。'] },
    { type: 'npc', id: 'gd_keiko', x: 56, y: 53, dir: 'left', look: { ...LOOKS.actress, top: '#3b3f48' }, name: '劇団の人', wander: 2,
      text: ['そこの稽古場、一時間いくらで借りられるのよ。', '芝居もコントも、声を出して動いてみないと\n仕上がらないからね。'] },
    { type: 'npc', id: 'gd_dancer', x: 63, y: 52, dir: 'down', look: { ...LOOKS.idol, top: '#ff7eb6' }, name: 'ダンサー', wander: 2,
      text: ['ダンススタジオの帰り！', 'このへんは、夢を追いかけてる人ばっかりだよ。\n芸人さんに、役者さんに、ダンサーに…。'] },
    { type: 'npc', id: 'gd_flyer', x: 30, y: 65, dir: 'down', look: { ...LOOKS.comedian2, top: '#ffd23f' }, name: 'チラシ配りの芸人',
      text: ['今夜、そこのライブハウスでお笑いライブやってまーす！', '若手ばっかり十二組。\n出るほうも見るほうも、真剣勝負です！'] },
    { type: 'npc', id: 'gd_engei_fan', x: 51, y: 65, dir: 'down', look: { ...LOOKS.oldman, top: '#5a4a3a' }, name: '演芸好きのおじいさん', wander: 1,
      text: ['この演芸場には、もう四十年かよってるよ。', '若いのが育っていくのを見るのが、いちばんの楽しみでねえ。'] },
  ];
}

// [R8-L1] the driving school (ドット自動車教習所, js/places/kyoshujo.js) and the licence centre (ドット運転免許センター, js/places/menkyo.js)
// stand on two free lots: the school at the east end of the 劇場通り (x 69..74, rows 59..64), the centre in the strip behind the
// railway fence (x 61..68, rows 40..43, its door on the lane at row 44). Old saves: unstick() moves anyone caught inside.
function licenseLots(c) {
  if (PLACES.kyoshujo) {
    fill(c, 68, 59, 7, 6, 'grass');
    put(c, 68, 60, 'bush'); put(c, 68, 62, 'planter'); put(c, 68, 64, 'sign_board');
  }
  if (PLACES.menkyo) {
    fill(c, 60, 40, 10, 4, 'grass');
    put(c, 60, 41, 'bush'); put(c, 69, 41, 'planter'); put(c, 60, 43, 'sign_board');
  }
}
function licenseEntities() {
  const out = [];
  if (PLACES.kyoshujo) out.push({ type: 'building', x: 69, y: 59, w: 6, h: 6, door: 3, place: 'kyoshujo', name: 'ドット自動車教習所', kind: 'office', wall: '#f1f4e8', roof: '#2f9a5a', canopy: '#2f9a5a', sign: { text: 'ドット自動車教習所', bg: '#2f9a5a', color: '#ffffff' } });
  if (PLACES.menkyo) out.push({ type: 'building', x: 61, y: 40, w: 8, h: 4, door: 4, place: 'menkyo', name: 'ドット運転免許センター', kind: 'office', wall: '#e4e8ee', roof: '#3a5a9a', canopy: '#3a5a9a', sign: { text: 'ドット運転免許センター', bg: '#2a4a8a', color: '#ffffff' } });
  if (PLACES.kyoshujo) out.push({ type: 'sign', x: 68, y: 64, text: ['「ドット自動車教習所」→ すぐそこ。', '免許をとりたい人は、受付へ。通学も合宿もあります。'] });
  if (PLACES.menkyo) out.push({ type: 'sign', x: 60, y: 43, text: ['「ドット運転免許センター」↑ この先、線路ぞい。', '学科試験・免許の更新・原付免許の手続きなど。受付は平日 午前9時〜午後4時。'] });
  return out;
}

function generate() {
  const W = TOKYO_W, H = TOKYO_H;
  const c = grid(W, H, 'grass');

  // ---- roads (the district's streets first, so the west avenue crosses them)
  hroad(c, 20, 1, W - 2);
  districtTiles(c, W);
  vroad(c, 19, 1, 68);   // the west avenue runs on through 芸人通り down to the 劇場通り
  vroad(c, 39, 1, 44);   // the centre avenue ends at the ネオン街 gate (row 45)
  vroad(c, 59, 1, 36);   // the east avenue ends at the railway fence
  for (const x of [17, 23, 37, 43, 57, 63]) for (let y = 20; y <= 22; y++) set(c, x, y, 'crosswalk_h');
  for (const y of [17, 25]) for (const x0 of [19, 39, 59]) for (let x = x0; x < x0 + 3; x++) set(c, x, y, 'crosswalk_v');
  for (const y of [52, 53, 54, 63]) for (let x = 19; x <= 21; x++) set(c, x, y, 'crosswalk_v');
  for (const x of [17, 23, 40]) for (let y = 66; y <= 68; y++) set(c, x, y, 'crosswalk_h');
  border(c, 'tree');
  // ---- east exit: the main road continues to テレビ局エリア (minato.js; warps below)
  for (let y = 19; y <= 23; y++) set(c, W - 1, y, y === 19 || y === 23 ? 'sidewalk' : y === 21 ? 'road_line_h' : 'road');
  // ---- west exit: the main road continues to ドット商店街 (machi.js; warps below)
  for (let y = 19; y <= 23; y++) set(c, 0, y, y === 19 || y === 23 ? 'sidewalk' : 'road');
  // ---- north exit: the center avenue continues to 永田町・霞が関 (nagatacho.js; warps below)
  if (PLACES.nagatacho) for (let x = 38; x <= 42; x++) set(c, x, 0, x === 38 || x === 42 ? 'sidewalk' : x === 40 ? 'road_line_v' : 'road');
  // ---- the ネオン街 gate: the center avenue continues to ネオン街 (kanraku.js; warps below)
  for (let x = 37; x <= 43; x++) {
    if (!PLACES.kanraku) put(c, x, TOKYO_GATE_Y, 'hedge');
    else set(c, x, TOKYO_GATE_Y, x <= 38 || x >= 42 ? 'sidewalk' : x === 40 ? 'road_line_v' : 'road');
  }

  // ---- block TL: NHK plaza
  fill(c, 2, 11, 15, 7, 'stone');
  for (const [x, y] of [[2, 2], [16, 2], [2, 11], [16, 11], [2, 17], [16, 17]]) put(c, x, y, 'tree');
  for (const [x, y] of [[4, 16], [14, 16]]) put(c, x, y, 'bench');
  for (let x = 3; x <= 15; x += 12) put(c, x, 12, 'planter');

  // ---- block TM: Horipro & Toho, brick plaza
  fill(c, 23, 11, 15, 7, 'brick');
  for (const [x, y] of [[23, 2], [30, 2], [23, 17], [37, 17]]) put(c, x, y, 'tree');
  put(c, 31, 14, 'planter'); put(c, 29, 14, 'planter');
  put(c, 36, 12, 'nobori'); put(c, 32, 12, 'nobori');
  put(c, 24, 15, 'bench');

  // ---- block TR: Toei studio lot
  fill(c, 43, 10, 15, 8, 'stone');
  for (let x = 43; x <= 57; x++) put(c, x, 2, x % 3 ? 'hedge' : 'tree');
  for (const [x, y] of [[44, 12], [45, 12]]) put(c, x, y, 'cone');
  put(c, 56, 12, 'boxes'); put(c, 57, 12, 'box'); put(c, 56, 13, 'box');
  put(c, 46, 15, 'sign_board');
  for (const [x, y] of [[43, 17], [57, 17]]) put(c, x, y, 'tree');

  // ---- block BL: home, convenience store, park
  fill(c, 1, 24, 17, 1, 'sidewalk');
  for (let y = 30; y < 32; y++) set(c, 4, y, 'path');
  fill(c, 11, 29, 6, 2, 'sidewalk');
  put(c, 10, 29, 'vending'); put(c, 17, 29, 'trash');
  put(c, 9, 30, 'mailbox');
  put(c, 1, 31, 'bicycle');
  // park
  fill(c, 2, 32, 15, 12, 'grass');
  fill(c, 3, 33, 13, 1, 'path'); fill(c, 3, 42, 13, 1, 'path');
  fill(c, 3, 33, 1, 10, 'path'); fill(c, 15, 33, 1, 10, 'path');
  fill(c, 8, 34, 3, 8, 'path');
  for (const [x, y] of [[2, 32], [16, 32], [2, 43], [16, 43], [5, 39], [13, 35]]) put(c, x, y, 'sakura');
  for (const [x, y] of [[12, 39], [13, 40], [5, 36]]) set(c, x, y, 'flowers');
  for (const [x, y] of [[7, 41], [11, 41]]) put(c, x, y, 'bench');
  for (let x = 2; x <= 16; x++) if (x !== 4 && x !== 9 && x !== 15) put(c, x, 31, 'hedge');

  // ---- block BM: yoshimoto / BS yoshimoto / grape / sento
  fill(c, 23, 32, 15, 3, 'stone');
  fill(c, 23, 41, 15, 3, 'stone');
  for (const [x, y] of [[23, 24], [37, 24], [37, 43], [23, 43]]) put(c, x, y, 'tree');
  put(c, 31, 33, 'nobori'); put(c, 23, 33, 'nobori');
  put(c, 31, 41, 'vending');
  put(c, 38, 42, 'lamp');

  // ---- block BR: station
  fill(c, 43, 24, 15, 2, 'stone');
  fill(c, 43, 31, 15, 6, 'brick');
  for (let x = 43; x <= W - 2; x++) { put(c, x, 37, 'fence'); set(c, x, 38, 'rail'); set(c, x, 39, 'rail'); }
  for (let x = 43; x <= W - 2; x++) if (x % 3 === 0) put(c, x, 41, 'tree');
  put(c, 44, 33, 'planter'); put(c, 56, 33, 'planter');
  put(c, 46, 35, 'bench');

  // ---- block NE (east of the new avenue): newspaper building, a small park
  for (const [x, y] of [[63, 2], [72, 2], [74, 5], [73, 9], [74, 13]]) put(c, x, y, 'tree');
  fill(c, 63, 12, 9, 6, 'stone');
  for (const [x, y] of [[72, 4], [73, 7], [72, 11]]) put(c, x, y, 'sakura');
  set(c, 74, 8, 'flowers'); set(c, 73, 11, 'flowers'); set(c, 74, 3, 'flowers');
  put(c, 64, 15, 'bench'); put(c, 65, 15, 'bench'); put(c, 70, 13, 'vending'); put(c, 71, 13, 'trash');
  for (const x of [63, 71]) put(c, x, 17, 'planter');
  // ---- block SE: a little plaza with a second bus stop, a park strip by the railway
  fill(c, 63, 24, 12, 3, 'stone');
  for (let y = 27; y <= 35; y++) set(c, 68, y, 'path');
  for (let x = 63; x <= 74; x++) set(c, x, 31, 'path');
  for (const [x, y] of [[64, 28], [66, 33], [70, 28], [73, 30], [72, 34], [64, 35]]) put(c, x, y, (x + y) % 3 ? 'tree' : 'sakura');
  for (const [x, y] of [[65, 29], [71, 33], [73, 27], [66, 35]]) set(c, x, y, 'flowers');
  put(c, 69, 29, 'bench'); put(c, 67, 33, 'bench'); put(c, 74, 25, 'vending');
  for (let y = 40; y <= 43; y++) for (let x = 59; x <= 74; x++) if ((x + y) % 4 === 0) put(c, x, y, 'tree');

  // ---- street furniture
  for (const x of [6, 13, 27, 33, 47, 53, 67, 72]) { put(c, x, 19, 'lamp'); put(c, x, 23, 'lamp'); }
  for (const y of [6, 13, 30, 36]) { put(c, 18, y, 'lamp'); put(c, 42, y, 'lamp'); put(c, 62, y, 'lamp'); }
  put(c, 22, 9, 'mailbox');
  put(c, 17, 18, 'sign_board');
  put(c, 38, 28, 'vending');
  put(c, 18, 48, 'lamp'); put(c, 22, 58, 'lamp'); put(c, 18, 62, 'lamp');

  licenseLots(c); // [R8-L1]
  const entities = [
    // buildings
    { type: 'building', x: 3, y: 3, w: 12, h: 8, door: 6, place: 'nhk', name: 'NHK放送センター', kind: 'tower', wall: '#e8ecf2', roof: '#8d9bb0', glass: '#6fa8dc', logo: 'nhk', signH: 22, signW: 120 },
    { type: 'building', x: 24, y: 4, w: 6, h: 7, door: 3, place: 'horipro', name: 'ホリプロ', kind: 'office', wall: '#f4f1ea', roof: '#5a5f6b', logo: 'horipro', signH: 32, signW: 36 },
    { type: 'building', x: 31, y: 3, w: 7, h: 8, door: 3, place: 'toho', name: '東宝', kind: 'theater', wall: '#ece4d2', roof: '#1f3a8a', logo: 'toho', signH: 38, signW: 40 },
    { type: 'building', x: 44, y: 3, w: 12, h: 7, door: 8, place: 'toei', name: '東映 撮影所', kind: 'studio', wall: '#d8d2c4', roof: '#7d8391', logo: 'toei', signH: 34, signW: 40 },
    { type: 'building', x: 2, y: 25, w: 7, h: 5, door: 2, place: 'home', name: 'ドット荘', kind: 'house', wall: '#efe2bf', roof: '#8a5a33', sign: { text: 'ドット荘', bg: '#fff6e0' } },
    { type: 'building', x: 11, y: 25, w: 6, h: 4, door: 3, place: 'konbini', name: 'ローソン', kind: 'shop', wall: '#f6f6f8', roof: '#e8eaee', stripes: ['#0068b7', '#ffffff', '#0068b7'], logo: 'lawson', signBg: '#0068b7', signH: 26 },
    { type: 'building', x: 23, y: 25, w: 8, h: 7, door: 4, place: 'yoshimoto', name: 'よしもと 東京本部', kind: 'office', wall: '#fff3e6', roof: '#e8492a', logo: 'yoshimoto', signH: 30, signW: 30 },
    { type: 'building', x: 32, y: 25, w: 6, h: 6, door: 3, place: 'bs_yoshimoto', name: 'BSよしもと', kind: 'office', wall: '#ffffff', roof: '#ff3b1f', logo: 'bs_yoshimoto', signH: 22, signW: 84 },
    { type: 'building', x: 24, y: 35, w: 7, h: 6, door: 3, place: 'grape', name: 'グレープカンパニー', kind: 'office', wall: '#f3eefa', roof: '#7a4fa0', logo: 'grape', signH: 34, signW: 36 },
    { type: 'building', x: 32, y: 36, w: 6, h: 5, door: 3, place: 'sento', name: '銭湯 ドットの湯', kind: 'bath', wall: '#f6e7c8', roof: '#3b4a6a', sign: { text: 'ゆ', bg: '#2a3a7a', color: '#ffffff', size: 12 } },
    { type: 'building', ...STATION, place: 'station_tokyo', name: '東京駅', kind: 'station', wall: '#b8644a', roof: '#4a5a70', sign: { text: '東京駅', bg: '#ffffff' }, enter: ekiEnter('tokyo', (g) => g.enterPlace('station_tokyo')) },
    { type: 'building', x: 63, y: 4, w: 8, h: 8, door: 4, name: 'ドット新聞社', kind: 'office', wall: '#e6e2d8', roof: '#4a5568', sign: { text: 'ドット新聞', bg: '#ffffff', color: '#20232a' },
      text: ['「ドット新聞社」のビルだ。', '芸能面の記事も、ここで書かれているらしい。\n…いつか自分の記事がのる日が来るかも？'] },
    // 芸人通り and the 劇場通り: NSC東京校 (from 1995), the 貸し稽古場 (js/places/nsc.js) …
    ...districtEntities(),
    ...licenseEntities(), // [R8-L1]

    // props
    fountain(8, 13),
    streetStage(6, 34, 4, { solid: false }),
    train(45, 38, { text: undefined }),
    { type: 'sign', x: 50, y: 37, text: 'フェンスの向こうに新幹線が停まっている。乗るなら駅のきっぷ売り場へ。' },
    taxi(48, 33), taxi(51, 33, '#2f9a4a'),
    busStop(55, 32, { text: undefined, talk: busToMachi }),
    busStop(66, 24, { text: undefined, talk: busToMachi }),
    statue(27, 13, { text: '「笑顔は世界をつなぐ」と刻まれた像だ。' }),

    // signs
    { type: 'sign', x: 46, y: 15, text: '東映 撮影所\n本日撮影中！関係者は正面入口へどうぞ。' },
    { type: 'sign', x: 17, y: 18, text: [
      '↑ NHK・ホリプロ・東宝・東映\n↓ よしもと・BSよしもと・グレープカンパニー\n→ 東京駅（新幹線で大阪へ）', '→→ テレビ局エリア（大通りを東のはしまで）\n← ドット商店街（大通りを西のはしまで）',
      ...(PLACES.nagatacho || PLACES.kanraku ? [[PLACES.nagatacho ? '↑↑ 永田町・霞が関（まん中の通りを北のはしまで）' : '', PLACES.kanraku ? '↓↓ ネオン街（まん中の通りを南のはしまで）' : ''].filter(Boolean).join('\n')] : []),
      '↓↓ 芸人通り・劇場通り（この通りを南へ）\n（スタジオ・小劇場・ライブハウス・演芸場）',
    ], solid: true },

    // NPCs
    {
      type: 'npc', id: 'oya', x: 6, y: 30, dir: 'down', look: LOOKS.oldwoman, name: '大家さん', talk: oyaTalk, person: 'oya',
    },
    {
      type: 'npc', id: 'street_comedian', x: 10, y: 36, dir: 'down', look: LOOKS.comedian, name: 'ストリート芸人', person: 'jiro',
      text: ['よう！ここのステージ、だれでも使ってええんやで。', '事務所に入ってなくても、路上で漫才や歌を披露すれば投げ銭がもらえるんや。', '腕も上がるし、ちょっとずつ顔も売れるで！'],
    },
    { type: 'npc', id: 'park_oldman', x: 12, y: 38, dir: 'left', look: LOOKS.oldman, name: 'おじいさん', wander: 2, text: ['ほっほっほ。この公園の桜は見事じゃろう。', '昔はここで若い芸人さんがよく練習しとったもんじゃ。'] },
    { type: 'npc', id: 'kid', x: 6, y: 40, dir: 'up', look: LOOKS.kid, name: 'こども', wander: 3, text: ['ねえねえ、テレビに出たことある？', 'ぼく、大きくなったら新喜劇みたいにズッコケる人になるんだ！'] },
    { type: 'npc', id: 'scout', x: 45, y: 24, dir: 'left', look: LOOKS.manager, name: 'スカウトマン', text: ['君、いい顔してるねえ…でも残念、うちは今は募集してないんだ。', '大阪のなんばには「よしもと新喜劇」の劇場や「松竹芸能」があるよ。', '東京駅から新幹線で新大阪へ行って、電車に乗りかえればすぐさ。'] },
    { type: 'npc', id: 'salaryman', x: 30, y: 19, dir: 'right', look: LOOKS.salaryman, name: 'サラリーマン', wander: 3, text: ['いやー、昨日のバラエティ番組は笑ったなあ。', 'お笑いの事務所に入りたいなら、よしもと、松竹芸能、グレープカンパニー…いろいろあるねえ。'] },
    { type: 'npc', id: 'fan', x: 28, y: 15, dir: 'up', look: LOOKS.fan, name: 'ファンの子', text: ['ホリプロの前で出待ちしてるの！', 'ホリプロは歌手や俳優さんが多い事務所なんだって。歌や演技に自信があるならオーディションを受けてみたら？'] },
    { type: 'npc', id: 'tourist', x: 10, y: 18, dir: 'up', look: LOOKS.tourist, name: '観光客', wander: 2, text: ['Wow! NHK! テレビ局の中、見学できるのかな？', 'ここでは毎日たくさんの番組が作られているらしいよ。'] },
    { type: 'npc', id: 'extra', x: 50, y: 13, dir: 'down', look: { ...LOOKS.samurai, top: '#8a5a33' }, name: 'エキストラさん', person: 'maruyama', text: ['拙者、本日は時代劇のエキストラでござる…なんてね！', '東映の撮影所では時代劇や特撮ヒーローの撮影をしてるんだ。体力勝負だよ〜。'] },
    { type: 'npc', id: 'young_comedian', x: 29, y: 33, dir: 'left', look: LOOKS.comedian2, name: '若手芸人', text: ['よしもとのオーディション、ツッコミのタイミングが命やで。', 'ボケを最後まで聞いてから、ビシッとツッコむ！早すぎても遅すぎてもアカン。'] },
    { type: 'npc', id: 'grape_fan', x: 33, y: 42, dir: 'up', look: { ...LOOKS.fan, hairColor: 'brown', top: '#9273bd' }, name: 'お笑いファン', wander: 2, text: ['グレープカンパニーの芸人さんのグッズ、買っちゃった！', 'お風呂屋さんの「ドットの湯」は、疲れがとれるって評判だよ。'] },
    { type: 'npc', id: 'tv_guide', x: 68, y: 18, dir: 'down', look: { ...LOOKS.staff, top: '#2f6fd0', hat: '#2f6fd0' }, name: '案内係さん', text: ['この大通りを東へまっすぐ行くと「テレビ局エリア」！', '日本テレビ、TBS、テレビ朝日、フジテレビ、テレビ東京…\nテレビ局がずらりと並んでるよ。', 'ちょっと遠いけど、とても広くて楽しい街さ。\nバス停からは、テレビ局エリア行きのバスもあるよ。'] },
    ...(PLACES.nagatacho ? [{ type: 'npc', id: 'poster_watcher', x: 43, y: 4, dir: 'up', look: { ...LOOKS.salaryman, top: '#6a7a8a' }, name: '道しるべを見る人', text: ['この通りを北へまっすぐ行くと、永田町。\n国会の見学は、だれでもできるんだって。', '選挙に出られるのは、25歳から。\n立候補の届出は、商店街の区役所でもできるらしいよ。'] }] : []),
    { type: 'npc', id: 'taxi_driver', x: 53, y: 34, dir: 'left', look: { ...LOOKS.guard, hat: '#3b3f48' }, name: 'タクシー運転手', text: ['お客さん、芸能人の卵？', '新幹線で大阪まで行けば、お笑いの本場・なんばもすぐそこだよ。運賃はちと高いけどね。'] },
  ];

  entities.push(machiSignpost(2, 18));
  entities.push(minatoSignpost(W - 2, 18));
  if (PLACES.nagatacho) entities.push(nagatachoSignpost(43, 3));
  if (PLACES.kanraku) entities.push(kanrakuSignpost(44, 42)); // beside the gate's east pillar
  const warps = [];
  for (let y = 19; y <= 23; y++) warps.push({ x: 0, y, place: 'machi', room: 'main', tx: 74, ty: y - 3, dir: 'left' }); // machi's road: rows 16..20 (its east edge, x 75: machi.js MACHI_W - 1)
  for (let y = 19; y <= 23; y++) warps.push({ x: W - 1, y, place: 'minato', room: 'main', tx: 1, ty: y + 5, dir: 'right' }); // minato's road: rows 24..28
  if (PLACES.nagatacho) for (let x = 38; x <= 42; x++) warps.push({ x, y: 0, place: 'nagatacho', room: 'main', tx: x, ty: 54, dir: 'up' }); // nagatacho's south exit: same columns
  if (PLACES.kanraku) for (let x = 38; x <= 42; x++) warps.push({ x, y: TOKYO_GATE_Y, place: 'kanraku', room: 'main', tx: x, ty: 1, dir: 'down' }); // kanraku's north edge: same columns

  return { w: W, h: H, cells: c, entities, warps, events: [{ x: 6, y: 34, w: 4, h: 2, on: 'action', run: streetLive }, { x: 6, y: 36, w: 4, h: 1, on: 'step', run: async (g) => { if (!g.flag('stageHint')) { g.setFlag('stageHint'); await g.say('小さなステージだ。ステージの前でAボタンを押すとパフォーマンスできそうだ。'); } } }] };
}

registerPlace({
  id: 'tokyo',
  name: '東京エリア',
  kind: 'town',
  bgm: 'town',
  start: { room: 'main', x: 4, y: 30, dir: 'down' },
  rooms: {
    // onEnter: a save made on a tile the map has since built over steps to the nearest free tile
    main: { generate, bg: '#62b35b', onEnter: async (g) => { unstick(g); } },
  },
});
