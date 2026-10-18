// 東京エリア: the main town. Most agencies and TV stations are here.

import { registerPlace, PLACES } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { grid, set, put, fill, hroad, vroad, border } from './townkit.js';
import { fountain, train, taxi, busStop, streetStage, statue } from './props.js';
import { text } from '../engine/draw.js';
export const TOKYO_W = 76; // x 60..75: the east block and the road to テレビ局エリア (minato.js)
export const TOKYO_H = 46;

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

function generate() {
  const W = TOKYO_W, H = TOKYO_H;
  const c = grid(W, H, 'grass');

  // ---- roads
  hroad(c, 20, 1, W - 2);
  vroad(c, 19, 1, H - 2);
  vroad(c, 39, 1, H - 2);
  vroad(c, 59, 1, 36);   // the east avenue ends at the railway fence
  for (const x of [17, 23, 37, 43, 57, 63]) for (let y = 20; y <= 22; y++) set(c, x, y, 'crosswalk_h');
  for (const y of [17, 25]) for (const x0 of [19, 39, 59]) for (let x = x0; x < x0 + 3; x++) set(c, x, y, 'crosswalk_v');
  border(c, 'tree');
  // ---- east exit: the main road continues to テレビ局エリア (minato.js; warps below)
  for (let y = 19; y <= 23; y++) set(c, W - 1, y, y === 19 || y === 23 ? 'sidewalk' : y === 21 ? 'road_line_h' : 'road');
  // ---- west exit: the main road continues to ドット商店街 (machi.js; warps below)
  for (let y = 19; y <= 23; y++) set(c, 0, y, y === 19 || y === 23 ? 'sidewalk' : 'road');
  // ---- north exit: the center avenue continues to 永田町・霞が関 (nagatacho.js; warps below)
  if (PLACES.nagatacho) for (let x = 38; x <= 42; x++) set(c, x, 0, x === 38 || x === 42 ? 'sidewalk' : x === 40 ? 'road_line_v' : 'road');
  // ---- south exit: the center avenue continues to ネオン街 (kanraku.js; warps below)
  if (PLACES.kanraku) for (let x = 38; x <= 42; x++) set(c, x, H - 1, x === 38 || x === 42 ? 'sidewalk' : x === 40 ? 'road_line_v' : 'road');

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
  for (let y = 40; y <= 44; y++) for (let x = 59; x <= 74; x++) if ((x + y) % 4 === 0) put(c, x, y, 'tree');

  // ---- street furniture
  for (const x of [6, 13, 27, 33, 47, 53, 67, 72]) { put(c, x, 19, 'lamp'); put(c, x, 23, 'lamp'); }
  for (const y of [6, 13, 30, 36]) { put(c, 18, y, 'lamp'); put(c, 42, y, 'lamp'); put(c, 62, y, 'lamp'); }
  put(c, 22, 9, 'mailbox');
  put(c, 17, 18, 'sign_board');
  put(c, 38, 28, 'vending');

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
    { type: 'building', x: 44, y: 26, w: 12, h: 5, door: 6, place: 'station_tokyo', name: '東京駅', kind: 'station', wall: '#b8644a', roof: '#4a5a70', sign: { text: '東京駅', bg: '#ffffff' } },
    { type: 'building', x: 63, y: 4, w: 8, h: 8, door: 4, name: 'ドット新聞社', kind: 'office', wall: '#e6e2d8', roof: '#4a5568', sign: { text: 'ドット新聞', bg: '#ffffff', color: '#20232a' },
      text: ['「ドット新聞社」のビルだ。', '芸能面の記事も、ここで書かれているらしい。\n…いつか自分の記事がのる日が来るかも？'] },

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
    { type: 'sign', x: 17, y: 18, text: ['↑ NHK・ホリプロ・東宝・東映\n↓ よしもと・BSよしもと・グレープカンパニー\n→ 東京駅（新幹線で大阪へ）', '→→ テレビ局エリア（大通りを東のはしまで）\n← ドット商店街（大通りを西のはしまで）'], solid: true },

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
    { type: 'npc', id: 'taxi_driver', x: 53, y: 34, dir: 'left', look: { ...LOOKS.guard, hat: '#3b3f48' }, name: 'タクシー運転手', text: ['お客さん、芸能人の卵？', '新幹線で大阪まで行けば、お笑いの本場・なんばもすぐそこだよ。運賃はちと高いけどね。'] },
  ];

  entities.push(machiSignpost(2, 18));
  entities.push(minatoSignpost(W - 2, 18));
  if (PLACES.nagatacho) entities.push(nagatachoSignpost(43, 3));
  if (PLACES.kanraku) entities.push(kanrakuSignpost(43, 43));
  const warps = [];
  for (let y = 19; y <= 23; y++) warps.push({ x: 0, y, place: 'machi', room: 'main', tx: 46, ty: y - 3, dir: 'left' }); // machi's road: rows 16..20
  for (let y = 19; y <= 23; y++) warps.push({ x: W - 1, y, place: 'minato', room: 'main', tx: 1, ty: y + 5, dir: 'right' }); // minato's road: rows 24..28
  if (PLACES.nagatacho) for (let x = 38; x <= 42; x++) warps.push({ x, y: 0, place: 'nagatacho', room: 'main', tx: x, ty: 54, dir: 'up' }); // nagatacho's south exit: same columns
  if (PLACES.kanraku) for (let x = 38; x <= 42; x++) warps.push({ x, y: H - 1, place: 'kanraku', room: 'main', tx: x, ty: 1, dir: 'down' }); // kanraku's north edge: same columns

  return { w: W, h: H, cells: c, entities, warps, events: [{ x: 6, y: 34, w: 4, h: 2, on: 'action', run: streetLive }, { x: 6, y: 36, w: 4, h: 1, on: 'step', run: async (g) => { if (!g.flag('stageHint')) { g.setFlag('stageHint'); await g.say('小さなステージだ。ステージの前でAボタンを押すとパフォーマンスできそうだ。'); } } }] };
}

registerPlace({
  id: 'tokyo',
  name: '東京エリア',
  kind: 'town',
  bgm: 'town',
  start: { room: 'main', x: 4, y: 30, dir: 'down' },
  rooms: {
    main: { generate, bg: '#62b35b' },
  },
});
