// なんばエリア (大阪): the home of comedy. Reached from 東京駅 (shinkansen to 新大阪, then a local train).
// West end (x 1..29): NSC大阪校 next to the 新喜劇 theatre, ドット劇場, a little park. Middle
// (x 30..72): theatres, the canal (道頓堀) and the station. East part (x 73..104, a riverside
// district): テレビ局通り with MBS毎日放送 ('mbs') and 関西テレビ ('ktv') on the north bank
// (js/places/osaka_tv.js), food stalls and おうぎの森公園 on the south bank.
// [R9-A] South of the canal-side street the town is NAMBA_DS rows deeper (rows 23..38): 戎橋筋 (a covered
// arcade from ことぶき橋 straight down to なんば駅), 千日前 (a street from the east bridge), にし通り (from
// にし橋), the cross street 千日前通り (rows 29..31, the taxi stand) and two rows of shops and theatres.
// Everything that was on rows 23.. before moved NAMBA_DS rows south (flags.map_namba 3 relocates saves).

import { registerPlace, PLACES } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { grid, set, put, fill, border, unstick, ekiEnter } from './townkit.js';
import { commuterTrain, fountain, streetStage, taxi } from './props.js';
import { text } from '../engine/draw.js';
import { makeCanvas, fmtMoney, TILE, shade } from '../engine/util.js';
import { outline, defineTile, R as TR, P as TP } from '../engine/tiles.js';

// [R9-A] 戎橋筋's paving (a covered arcade): cream and terracotta slabs in a diagonal band
defineTile('namba_arcade', {
  variants: 2,
  draw(c, r, f, v) { TR(c, 0, 0, 16, 16, '#d8c8a8'); TR(c, 0, 0, 16, 1, '#e8dcc0'); TR(c, v ? 8 : 0, 8, 8, 8, '#c89a7a'); TR(c, 0, 15, 16, 1, '#b8a888'); },
  hd(c, r, f, v) {
    TR(c, 0, 0, 32, 32, '#a89a80');
    for (let k = 0; k < 4; k++) {
      const x = 1 + (k % 2) * 16, y = 1 + (k >> 1) * 16, col = (k + v) % 3 === 0 ? '#d8a080' : (k % 2 ? '#efe4cc' : '#e6d8ba');
      TR(c, x, y, 15, 15, col); TR(c, x, y, 15, 1, shade(col, 0.1)); TR(c, x, y + 14, 15, 1, shade(col, -0.1)); TR(c, x + 14, y + 1, 1, 13, shade(col, -0.06));
      TP(c, x + 3 + ((k * 5 + v * 3) % 9), y + 4 + ((k * 7) % 8), shade(col, -0.08));
    }
  },
});

// Blinking neon billboard on a pole (3x2 tiles).
function neon(x, y, label, color, extra = {}) {
  return {
    type: 'prop', x, y, w: 3, h: 2,
    text: `ネオン看板だ。「${label}」の文字がピカピカ光っている。`,
    draw(ctx, sx, sy, g) {
      ctx.fillStyle = '#3b3f48'; ctx.fillRect(sx + 22, sy + 14, 4, 18);
      ctx.fillStyle = '#20232a'; ctx.fillRect(sx, sy - 6, 48, 22);
      ctx.fillStyle = color; ctx.fillRect(sx + 1, sy - 5, 46, 20);
      ctx.fillStyle = '#20232a'; ctx.fillRect(sx + 3, sy - 3, 42, 16);
      for (let i = 0; i < 12; i++) {
        const on = (Math.floor(g.frame / 12) + i) % 2 === 0;
        ctx.fillStyle = on ? '#fff6a8' : '#8a6a20';
        ctx.fillRect(sx + 2 + i * 4, sy - 5, 2, 1);
        ctx.fillRect(sx + 2 + i * 4, sy + 14, 2, 1);
      }
      const flick = Math.floor(g.frame / 90) % 7 === 0 && g.frame % 6 < 3;
      text(ctx, label, sx + 24, sy - 1, { size: 12, align: 'center', color: flick ? '#5a5f6b' : color, shadow: null });
    },
    ...extra,
  };
}

// A food stall: one thing to buy (and eat or drink on the spot).
async function stall(g, { greet, item }) {
  const i = await g.ask(greet, [`${item.name} ${fmtMoney(item.price)}`, 'やめとく'], { cancel: 1 });
  if (i !== 0) return;
  if (item.fill && !g.canEat()) { await g.say('おなかいっぱいで、もう入らない…。'); return; }
  if (!g.spend(item.price)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin');
  const st = g.state.stamina, sr = g.state.life.stress;
  if (item.fill) g.eat(item.heal || 0, { silent: true, fill: item.fill });
  const day = String(g.flag('namba_stall_day') || '').split(':');
  const n = Number(day[0]) === g.state.day ? Number(day[1]) + 1 : 1;
  g.setFlag('namba_stall_day', `${g.state.day}:${n}`);
  g.relax({ stress: n <= 2 ? item.stress : 1 });
  const out = [];
  if (g.state.stamina !== st) out.push(`体力+${g.state.stamina - st}`);
  if (g.state.life.stress !== sr) out.push(`ストレス${g.state.life.stress - sr}`);
  await g.say([item.text, out.join('　') || 'ほっとひと息。']);
}
const ikayaki = (g) => stall(g, { greet: 'いか焼きの屋台や！\n「ふわっふわの大阪名物、焼きたてやで〜！」', item: { name: 'いか焼き', price: 250, heal: 10, fill: 18, stress: 3, text: 'いかと生地を鉄板でぎゅっとプレス！\nふわふわ、もちもち…うまい！' } });
const mixJuice = (g) => stall(g, { greet: 'ミックスジュースのお店や！\n「昔ながらの、なつかしい味やで〜」', item: { name: 'ミックスジュース', price: 300, stress: 5, text: 'バナナにみかん、ミルク…。\nやさしい甘さで、ほっとする。' } });

// A sightseeing boat going up and down the river between the bridges (non-solid).
let boatCv = null;
function riverBoat(x0, x1, y) {
  return {
    type: 'prop', x: x0, y, w: x1 - x0, h: 3, solid: false,
    text: undefined,
    draw(ctx, sx, sy, g) {
      if (sy + 48 < -8 || sy > 188 || sx + (x1 - x0) * 16 < -8 || sx > 328) return;
      if (!boatCv) {
        const [cv, c] = makeCanvas(80, 28);
        const F = (x, yy, w, h, col) => { c.fillStyle = col; c.fillRect(x, yy, w, h); };
        F(2, 14, 72, 10, '#ffffff'); F(6, 24, 64, 3, '#d62f2f'); for (let i = 0; i < 6; i++) F(74 + i, 14 + i, 1, 10 - i * 2, '#ffffff');
        F(14, 4, 46, 10, '#ffd23f'); F(14, 4, 46, 2, '#fff2a0'); for (let x = 18; x < 58; x += 8) F(x, 7, 5, 5, '#3a5878');
        F(10, 16, 60, 2, '#d62f2f');
        outline(c, { tint: 0.3 });
        boatCv = cv;
      }
      const span = (x1 - x0) * 16 - 44, period = span * 2 / 0.3;
      const k = (g.frame % period) * 0.3, pos = k < span ? k : span * 2 - k, right = k < span;
      const bx = Math.round((sx + 2 + pos) * 2) / 2, by = sy + 13 + Math.round(Math.sin(g.frame / 30) * 2) / 2;
      ctx.save();
      if (!right) { ctx.translate(bx * 2 + 40, 0); ctx.scale(-1, 1); }
      ctx.drawImage(boatCv, bx, by, 40, 14);
      ctx.restore();
    },
  };
}

// The town grew west (x 0..29: NSC大阪校 next to the 新喜劇 theatre, ドット劇場, a little park and a
// taxi stand); everything that was here before moved OX tiles east. Saves made before that stand
// OX tiles too far west: namba's onEnter moves them (flags.map_namba marks a game already moved).
export const NAMBA_OX = 30;
export const NAMBA_W = 76 + NAMBA_OX; // x 73..104: the riverside テレビ局通り (x 30..72: theatres, the canal and the station)
// [R9-A] NAMBA_DS rows inserted at row NAMBA_BAND (the 戎橋筋・千日前 district between the canal-side street
// and the station's row); everything south of them moved down
export const NAMBA_BAND = 23;
export const NAMBA_DS = 16;
export const NAMBA_H = 38 + NAMBA_DS;
const OX = NAMBA_OX, DS = NAMBA_DS, BAND = NAMBA_BAND;
// [R9-A] なんば駅: its door leads into the rail network's 駅構内 (place 'eki', room 'namba') once that exists
// (before: station_namba). A train arrival appears in front of the door.
export const EKI = { x: 22 + OX, y: 30 + DS, dir: 'down' };

// The west part (x 1..29): its own buildings and people (rows 23.. move NAMBA_DS rows south in
// generate()). The map app's なんば arrival (phone_apps.js, at [22, 30]) is the taxi stand on
// 千日前通り (bandEntities).
function westEntities() {
  return [
    // north side of the theatre street (fronts on row 10)
    { type: 'building', x: 2, y: 5, w: 6, h: 5, door: 3, name: '道具屋', kind: 'shop', wall: '#f2ece0', roof: '#5a4a3a', display: 'goods', stripes: ['#2a3a7a', '#f2ece0'], sign: { text: '道具屋', bg: '#2a3a7a', color: '#ffffff' },
      text: ['料理道具の店だ。', 'たこ焼き器に、のれんに、食品サンプル…。\n店の道具なら、なんでもそろうらしい。'] },
    { type: 'building', x: 9, y: 3, w: 9, h: 7, door: 4, name: 'ドット劇場', kind: 'theater', wall: '#f6ead8', roof: '#2a6ad0', sign: { text: 'ドット劇場', bg: '#20232a', color: '#ffd23f' },
      text: ['若手芸人が毎日ネタをかける、小さな劇場だ。', '入口の出番表に、知らないコンビ名がずらりと並んでいる。\nNSCを出たばかりの芸人も、ここから舞台に立つらしい。'] },
    ...(PLACES.nsc ? [{ type: 'building', x: 20, y: 3, w: 10, h: 7, door: 5, place: 'nsc', name: 'NSC大阪校', kind: 'office', wall: '#fff3e6', roof: '#e8492a', canopy: '#e8492a', sign: { text: 'NSC大阪校', bg: '#e8492a', color: '#ffffff' } }]
      : [{ type: 'building', x: 20, y: 3, w: 10, h: 7, door: 5, name: '貸しビル', kind: 'office', wall: '#e4e2dc', roof: '#7a7f8a', sign: { text: 'テナント募集', bg: '#ffffff', color: '#d62f2f' }, text: '「テナント募集」の貼り紙がある。' }]),
    neon(13, 13, 'ライブ', '#ff7eb6'),
    // south of the canal: a ramen shop, karaoke, the little park, the taxi stand
    { type: 'building', x: 14, y: 23, w: 6, h: 4, door: 3, name: 'ラーメン屋', kind: 'ramen', sign: { text: 'ラーメン', bg: '#d62f2f', color: '#ffffff' },
      text: ['ラーメン屋だ。', '「NSC生は替え玉一杯無料」の貼り紙がある。'] },
    { type: 'building', x: 21, y: 23, w: 7, h: 4, door: 3, name: 'カラオケ', kind: 'karaoke', sign: { text: 'カラオケ', bg: '#20232a', color: '#ff7eb6' },
      text: ['カラオケ店だ。', '個室でネタ合わせをする芸人も多いらしい。'] },
    { type: 'sign', x: 21, y: 15, text: ['なんば・にし橋\n北：NSC大阪校・ドット劇場・道具屋\n南：にし通り・千日前通り（タクシー乗り場）・公園', '東：よしもと新喜劇 劇場・松竹芸能・戎橋筋・なんば駅'] },

    // people
    { type: 'npc', id: 'nw_nsc', x: 24, y: 12, dir: 'down', look: { ...LOOKS.comedian, top: '#e8492a', hairColor: 'black' }, name: 'NSC生', wander: 2,
      text: ['授業終わりや。今日のネタ見せ、ボロカスに言われたわ…。', 'せやけど、となりが劇場やろ？\nほんまもんの芸人さんの出入りを、毎日見られるんや。'] },
    { type: 'npc', id: 'nw_fan', x: 12, y: 11, dir: 'up', look: { ...LOOKS.fan, hairColor: 'brown', top: '#ff7eb6' }, name: 'お笑いファン',
      text: ['ここの劇場は、若手の芸人さんばっかり出てるねん。', 'まだ売れてへん子を、今のうちから応援するんが\nいちばん楽しいんよ。'] },
    { type: 'npc', id: 'nw_dogu', x: 4, y: 11, dir: 'down', look: { ...LOOKS.oldman, top: '#2a3a7a' }, name: '道具屋のおっちゃん', wander: 1,
      text: ['たこ焼き器、いらんか？\n…いらんか。', 'このへんは劇場の街やけど、料理道具の街でもあるんやで。'] },
    { type: 'npc', id: 'nw_boke', x: 5, y: 26, dir: 'right', look: { ...LOOKS.comedian2, top: '#ffd23f' }, name: 'ネタ合わせ中の芸人', fixedDir: true,
      text: ['…ほんでな、オカンがな、言うねん。', '（ネタ合わせの最中みたいだ）'] },
    { type: 'npc', id: 'nw_tsukkomi', x: 6, y: 26, dir: 'left', look: { ...LOOKS.comedian, top: '#2f9a4a', hairColor: 'black' }, name: 'ネタ合わせ中の芸人', fixedDir: true,
      text: ['もうええわ！…って、まだ途中やった。', 'NSCの同期と組んだばっかりやねん。\n公園でネタ合わせするんが、いちばんタダやからな。'] },
  ];
}

function generate() {
  const W = NAMBA_W, H = NAMBA_H;
  const c = grid(W, H - DS, 'stone'); // the layout before the band; generate() opens the band at the end
  // the old part's tiles, OX tiles east
  const S = (x, y, ...l) => set(c, x + OX, y, ...l);
  const P = (x, y, o) => put(c, x + OX, y, o);
  const F = (x, y, w, h, ...l) => fill(c, x + OX, y, w, h, ...l);

  // canal with railings and bridges (the west part's にし橋 at x 18..20)
  for (let x = 1; x < W - 1; x++) {
    const o = x - OX;
    const bridge = (x >= 18 && x <= 20) || (o >= 9 && o <= 11) || (o >= 30 && o <= 32) || (o >= 59 && o <= 61);
    for (let y = 16; y <= 18; y++) set(c, x, y, bridge ? 'bridge_v' : 'canal');
    if (!bridge) { put(c, x, 15, 'railing'); put(c, x, 19, 'railing'); }
  }
  // north street, south arcade street, station plaza + rails: the whole width
  fill(c, 1, 10, W - 2, 5, 'brick');
  fill(c, 1, 20, W - 2, 3, 'brick');
  fill(c, 1, 30, W - 2, 3, 'brick');
  for (let x = 1; x < W - 1; x++) { put(c, x, 33, 'fence'); set(c, x, 34, 'rail'); set(c, x, 35, 'rail'); set(c, x, 36, 'grass'); }
  for (const x of [14, 29]) P(x, 23, 'lantern');
  border(c, 'tree');

  // ---- west part (x 1..29)
  for (const [x, y] of [[1, 1], [8, 2], [18, 1], [19, 9], [30, 1]]) put(c, x, y, 'tree');
  for (const [x, y] of [[8, 9], [18, 8]]) put(c, x, y, 'lantern');
  put(c, 2, 4, 'nobori'); put(c, 7, 4, 'nobori');
  for (const x of [9, 17, 20, 29]) put(c, x, 10, 'nobori');
  put(c, 6, 13, 'bench'); put(c, 27, 13, 'vending'); put(c, 28, 13, 'trash');
  // the little park south of the canal (ネタ合わせ spot), the shops' forecourt
  fill(c, 1, 23, 12, 7, 'grass');
  fill(c, 2, 27, 10, 1, 'path'); fill(c, 9, 23, 2, 7, 'path');
  for (const [x, y] of [[1, 23], [12, 23], [2, 29], [12, 29], [6, 23]]) put(c, x, y, (x + y) % 2 ? 'sakura' : 'tree');
  for (const [x, y] of [[3, 24], [4, 28], [11, 25]]) set(c, x, y, 'flowers');
  put(c, 3, 25, 'bench'); put(c, 7, 29, 'bench');
  fill(c, 13, 27, 17, 3, 'stone');
  put(c, 13, 26, 'planter'); put(c, 20, 26, 'planter'); put(c, 28, 26, 'vending');
  put(c, 14, 31, 'bench'); put(c, 3, 31, 'bench');
  set(c, 20, 31, 'sidewalk'); put(c, 20, 31, 'sign_board');

  // ---- the old part (x 30..105)
  for (const [x, y] of [[2, 10], [15, 10], [17, 10], [26, 10]]) P(x, y, 'nobori');
  for (const [x, y] of [[16, 8], [27, 6], [33, 6]]) P(x, y, 'lantern');
  P(32, 8, 'kanban_takoyaki');
  for (const [x, y] of [[16, 2], [27, 2], [32, 2], [42, 1]]) P(x, y, 'tree');
  P(13, 13, 'bench'); P(36, 13, 'bench');
  P(28, 12, 'vending'); P(14, 30, 'vending');
  for (const [x, y] of [[14, 26], [29, 26]]) P(x, y, 'planter');
  P(8, 31, 'bench'); P(36, 31, 'bench');
  // east: テレビ局通り (north bank) and おうぎの森公園 (south bank)
  for (let x = 43; x <= 74; x++) P(x, 1, x % 3 ? 'tree' : 'bush');
  for (const [x, y] of [[43, 3], [44, 6], [43, 9], [73, 3], [74, 6], [73, 9]]) P(x, y, 'tree');
  P(44, 8, 'lantern');
  F(55, 2, 7, 8, 'grass');
  for (const [x, y] of [[55, 2], [58, 2], [61, 3], [56, 5], [60, 6], [55, 8]]) P(x, y, (x + y) % 2 ? 'sakura' : 'tree');
  for (const [x, y] of [[57, 4], [59, 4], [58, 7], [61, 8]]) S(x, y, 'flowers');
  P(57, 9, 'bench'); P(59, 9, 'bench');
  for (const x of [46, 53, 64, 71]) P(x, 14, 'sakura');
  for (const x of [56, 63]) P(x, 10, 'nobori');
  for (const x of [43, 54, 66, 70]) P(x, 23, 'lantern');
  // stall corner and the plaza by the station
  F(43, 26, 11, 4, 'stone');
  P(44, 28, 'bench'); P(45, 28, 'bench'); P(52, 27, 'vending'); P(53, 27, 'trash');
  P(48, 29, 'planter'); P(43, 29, 'planter');
  // the park
  F(55, 23, 20, 7, 'grass');
  for (let x = 55; x <= 74; x++) S(x, 27, 'path');
  for (let y = 23; y <= 29; y++) { S(55, y, 'path'); S(60, y, 'path'); }
  for (const [x, y] of [[57, 24], [72, 23], [68, 25], [74, 29], [57, 29], [70, 29], [65, 29]]) P(x, y, (x + y) % 2 ? 'sakura' : 'tree');
  for (const [x, y] of [[58, 25], [67, 24], [73, 25], [62, 29], [66, 28], [71, 28]]) S(x, y, 'flowers');
  P(63, 28, 'bench'); P(69, 28, 'bench');

  const old = [
    { type: 'building', x: 3, y: 2, w: 12, h: 8, door: 6, place: 'shinkigeki', name: 'よしもと新喜劇 劇場', kind: 'theater', wall: '#f6e7c8', roof: '#d62f2f', logo: 'shinkigeki', signH: 34, signW: 44 },
    { type: 'building', x: 18, y: 3, w: 8, h: 7, door: 4, place: 'shochiku', name: '松竹芸能', kind: 'office', wall: '#f8f0e8', roof: '#d8101c', logo: 'shochiku', signH: 20, signW: 90 },
    { type: 'building', x: 28, y: 6, w: 4, h: 4, door: 2, place: 'takoyaki', name: 'たこ焼き屋', kind: 'small', wall: '#f6e7c8', roof: '#d62f2f', sign: { text: 'たこ焼き', bg: '#ff8a3d', color: '#ffffff' } },
    { type: 'building', x: 34, y: 2, w: 8, h: 8, door: 4, place: 'hotel', name: 'ドットホテル なんば', kind: 'hotel', wall: '#e8e4f0', roof: '#3a4a7a', sign: { text: 'ドットホテル', bg: '#1d2a5e', color: '#ffd23f' } },
    { type: 'building', x: 16, y: 25, w: 12, h: 5, door: 6, place: 'station_namba', name: 'なんば駅', kind: 'station', wall: '#d8d2c4', roof: '#d62f2f', sign: { text: 'なんば駅', bg: '#ffffff' }, enter: ekiEnter('namba', (g) => g.enterPlace('station_namba')) },
    { type: 'building', x: 1, y: 23, w: 6, h: 4, door: 3, name: 'お好み焼き屋', kind: 'small', wall: '#f6e7c8', roof: '#2a3a7a', sign: { text: 'お好み焼き', bg: '#2a3a7a', color: '#ffffff' }, text: '「本日は貸切です」と書いてある。ソースのいいにおいがする…！' },
    // (the 串カツ屋 that stood at x 7..12 here moved into 千日前通り's block: bandEntities, R9-A)
    { type: 'building', x: 30, y: 23, w: 6, h: 4, door: 3, name: 'ゲームセンター', kind: 'shop', wall: '#2a2d36', roof: '#8a5ac8', stripes: ['#ff7eb6', '#5fd7ff'], sign: { text: 'ゲーム', bg: '#20232a', color: '#5fd7ff' }, text: 'ピコピコ…中からゲームの音が聞こえる。今日はお仕事に集中しよう。' },
    { type: 'building', x: 45, y: 2, w: 10, h: 8, door: 5, place: 'mbs', name: 'MBS毎日放送', kind: 'tower', style: 'glass', wall: '#eef1f6', roof: '#1f5fbf', glass: '#6aa2ec', canopy: '#143f86', sign: { text: 'MBS毎日放送', bg: '#ffffff', color: '#1f5fbf' }, signH: 24 },
    { type: 'building', x: 62, y: 2, w: 11, h: 8, door: 5, place: 'ktv', name: '関西テレビ', kind: 'office', wall: '#f6f1ea', roof: '#e8731c', glass: '#8fc8ec', canopy: '#a24c0c', sign: { text: '関西テレビ', bg: '#ffffff', color: '#e8731c' }, signH: 24, plants: true },
    { type: 'building', x: 44, y: 23, w: 4, h: 3, door: 2, name: 'いか焼き屋台', kind: 'small', wall: '#f6e7c8', roof: '#2a3a7a', sign: { text: 'いか焼き', bg: '#ffffff', color: '#2a3a7a' }, talk: ikayaki },
    { type: 'building', x: 49, y: 23, w: 4, h: 3, door: 2, name: 'ミックスジュース', kind: 'small', wall: '#fff6e0', roof: '#ff8a3d', sign: { text: 'ジュース', bg: '#ffd23f', color: '#d62f2f' }, talk: mixJuice },
    streetStage(62, 24, 4, { z: -40 }),
    riverBoat(33, 58, 16),
    neon(59, 12, 'テレビ', '#ffa860'),
    { type: 'sign', x: 58, y: 15, solid: true, text: ['テレビ局通り', '北：MBS毎日放送・関西テレビ\n南：いか焼き・ミックスジュース・おうぎの森公園\n西：よしもと新喜劇 劇場・松竹芸能・なんば駅'] },
    { type: 'building', x: 36, y: 23, w: 6, h: 4, door: 3, name: 'おみやげ屋', kind: 'shop', wall: '#ffffff', roof: '#ffd23f', stripes: ['#d62f2f', '#ffd23f'], sign: { text: 'おみやげ', bg: '#ffffff', color: '#d62f2f' }, text: '「ただいま棚卸し中」の札がかかっている。' },
    neon(5, 13, 'なんば', '#ff4f8b'),
    neon(24, 13, 'お笑い', '#5fd7ff'),
    neon(39, 13, 'グルメ', '#ffd23f'),
    commuterTrain(4, 34, { text: undefined }),
    { type: 'sign', x: 8, y: 33, text: 'フェンスの向こうに、電車が停まっている。\n東京へは、駅のきっぷ売り場へ。\n（新大阪で新幹線に乗りかえ）' },
    fountain(37, 30, { text: '待ち合わせスポットの噴水だ。' }),
    { type: 'sign', x: 12, y: 15, text: ['なんば・ことぶき橋\n北：よしもと新喜劇 劇場・松竹芸能・たこ焼き屋・ホテル\n南：戎橋筋（アーケード）をまっすぐ、なんば駅', '西：劇場のとなりに NSC大阪校、ドット劇場\n東：川ぞいの「テレビ局通り」（MBS毎日放送・関西テレビ）・千日前'] },

    { type: 'npc', id: 'obachan', x: 12, y: 21, dir: 'down', look: { ...LOOKS.oldwoman, top: '#ff7eb6', hairColor: 'purple' }, name: '大阪のおばちゃん', person: 'tamae', talk: async (g, npc) => {
      if (!g.flag('ame_' + g.state.day)) {
        g.setFlag('ame_' + g.state.day);
        await g.say(['あら、あんた見ん顔やね！東京から来たん？', 'ほな、アメちゃんあげるわ！のどにええで〜。'], { name: npc.name, look: npc.look });
        g.giveItem('nodoame');
        g.sfx('coin');
      } else {
        await g.say(['今日のアメちゃんはもうあげたで！', 'また明日おいで〜。'], { name: npc.name, look: npc.look });
      }
    } },
    { type: 'npc', id: 'barker', x: 9, y: 11, dir: 'down', look: { ...LOOKS.staff, hat: '#d62f2f', top: '#d62f2f' }, name: '劇場の呼び込み', text: ['よしもと新喜劇、本日も公演中やでー！', '新喜劇といえば、みんなでそろってズッコケるのがお約束や！', 'よしもとの芸人さんなら舞台に立てるチャンスもあるらしいで。'] },
    { type: 'npc', id: 'shochiku_young', x: 21, y: 12, dir: 'down', look: { ...LOOKS.comedian, top: '#d8101c', hairColor: 'black' }, name: '若手芸人', wander: 2, text: ['松竹芸能は大阪に本社がある老舗の芸能事務所なんや。', 'しゃべりの腕を磨きたいんやったら、オーディション受けてみたらええ。'] },
    { type: 'npc', id: 'tako_fan', x: 30, y: 11, dir: 'up', look: LOOKS.kid, name: 'こども', text: ['ここのたこ焼き、外はカリッと中はトロ〜やで！', '食べたら元気モリモリや！'] },
    { type: 'npc', id: 'namba_tourist', x: 22, y: 21, dir: 'down', look: LOOKS.tourist, name: '観光客', wander: 3, text: ['Osaka is so fun! みんな話しかけてくれるよ！', '川沿いの看板がすごくカラフルだね！'] },
    { type: 'npc', id: 'station_staff', x: 19, y: 31, dir: 'down', look: LOOKS.guard, name: '駅員さん', text: ['なんば駅へようこそ！', '東京へ戻るときは、駅の中の窓口できっぷを買ってくださいね。'] },
    { type: 'npc', id: 'namba_mbs_fan', x: 48, y: 11, dir: 'up', look: { ...LOOKS.fan, top: '#6aa2ec' }, name: 'ファンの子', text: ['MBSの前で出待ちしてんねん！', 'MBS毎日放送は、大阪のテレビ局やで。\nバラエティに情報番組、ドラマ…\n全国に届く番組も、ぎょうさん作ってはるんや。'] },
    { type: 'npc', id: 'namba_ktv_fan', x: 65, y: 11, dir: 'up', look: { ...LOOKS.fan, hairColor: 'black', top: '#ffa860' }, name: 'お笑いファン', text: ['関西テレビの前で、収録帰りの芸人さんを待ってるねん。', '関西テレビは、地元・関西の人に愛される番組を\nずっと作ってきたテレビ局なんやで。'] },
    { type: 'npc', id: 'namba_ktv_staff', x: 70, y: 12, dir: 'left', look: { ...LOOKS.staff, top: '#e8731c' }, name: 'ADさん', wander: 1, text: ['ロケ帰りや〜。今日は商店街を一日歩いたで。', '大阪のロケは、街の人がみんな話しかけてくれるから\n楽しいけど、なかなか前に進まへんねん！'] },
    { type: 'npc', id: 'namba_river_oldman', x: 57, y: 13, dir: 'down', look: { ...LOOKS.oldman, top: '#5a6f8a' }, name: 'おっちゃん', wander: 2, text: ['この川ぞいの桜並木、ええやろ？', '向こう岸にテレビ局が2つ。\nこの通りは、ちっちゃい「テレビ局通り」や。\nわしはずっと、ここで見てきたで。'] },
    { type: 'npc', id: 'namba_stage_mc', x: 64, y: 24, dir: 'down', look: { ...LOOKS.announcerM, top: '#ffd23f' }, name: '司会のお兄さん', fixedDir: true, text: ['公園のステージで、公開収録の準備中や！', '大阪の番組は、お客さんとの距離が近いんが自慢やで。\n…お客さんのほうがおもろいこともあるけどな！'] },
    { type: 'npc', id: 'namba_east_tourist', x: 58, y: 21, dir: 'down', look: { ...LOOKS.tourist, top: '#5fd7ff' }, name: '観光客', wander: 3, text: ['川の向こうに、テレビ局が2つも並んでるね！', 'ミックスジュースって、大阪の喫茶店の名物なんだって。\nやさしい味で、おいしかった〜。'] },
    { type: 'npc', id: 'namba_juice_kid', x: 50, y: 27, dir: 'up', look: { ...LOOKS.kid, top: '#ffd23f' }, name: 'こども', text: ['いか焼きとミックスジュース、\nどっちから食べよかな〜。', '…両方や！'] },
    { type: 'npc', id: 'hotel_guest', x: 37, y: 12, dir: 'left', look: LOOKS.salaryman, name: '出張中の人', text: ['大阪で一泊するなら、そこのドットホテルがおすすめですよ。', '体力も回復するし、セーブもできるそうです。'] },
  ];

  for (const e of old) e.x += OX;
  // [R9-A] open the band: NAMBA_DS fresh rows at row BAND, everything south of it moves down
  c.splice(BAND, 0, ...Array.from({ length: DS }, () => Array.from({ length: W }, () => ['stone'])));
  const entities = [...westEntities(), ...old];
  for (const e of entities) if (e.y >= BAND) e.y += DS;
  bandTiles(c, W);
  return { w: W, h: H, cells: c, entities: [...entities, ...bandEntities()] };
}


// ---------------------------------------------------------------- [R9-A] the 戎橋筋・千日前 band (rows 23..38)
// N-S: にし通り (x 18..20, from にし橋), 戎橋筋 (x 38..42, a covered arcade from ことぶき橋 down through the
// shop row to なんば駅's plaza, rows 23..45), 千日前 (x 60..62, from the east bridge), the park path (x 89..91).
// E-W: a walk along the canal-side street (row 23), 千日前通り (rows 29..31), a back lane (row 38).
// Row A shops on rows 24..28 (doors on row 28), row B on rows 33..37 (doors on row 37).
const BAND_A = { y: 24, h: 5 }, BAND_B = { y: 33, h: 5 };
function bandTiles(c, W) {
  for (let y = BAND; y < BAND + DS; y++) { set(c, 0, y, 'grass', 'tree'); set(c, W - 1, y, 'grass', 'tree'); }
  fill(c, 1, 29, W - 2, 3, 'brick');                       // 千日前通り
  for (const [x0, w] of [[18, 3], [60, 3]]) fill(c, x0, BAND, w, DS, 'brick');
  fill(c, 38, BAND, 5, DS + 7, 'namba_arcade');            // 戎橋筋, on down to the station plaza (row 46)
  for (const y of [25, 27, 34, 36, 40, 43]) { put(c, 38, y, 'lantern'); put(c, 42, y, 'lantern'); }
  // the park north of おうぎの森公園 (x 89..104), its path on from the east bridge
  fill(c, 89, BAND, 16, DS, 'grass');
  fill(c, 89, BAND, 3, DS, 'path');
  fill(c, 92, 30, 12, 1, 'path');
  for (const [x, y] of [[93, 24], [97, 25], [101, 24], [103, 27], [95, 33], [99, 35], [103, 33], [94, 37], [102, 37], [88, 26], [88, 34]]) put(c, x, y, (x + y) % 2 ? 'sakura' : 'tree');
  for (const [x, y] of [[95, 27], [99, 28], [96, 34], [100, 33], [92, 36]]) set(c, x, y, 'flowers');
  for (const x of [95, 99]) put(c, x, 31, 'bench');
  // street furniture
  for (const x of [9, 28, 51, 70, 82]) put(c, x, 32, 'planter');
  for (const [x, y] of [[17, 23], [37, 32], [59, 23], [63, 32], [87, 38]]) put(c, x, y, 'vending');
  put(c, 36, 38, 'bicycle'); put(c, 44, 38, 'bicycle'); put(c, 64, 38, 'bicycle');
  put(c, 1, 38, 'trash'); put(c, 58, 38, 'trash');
}
// 戎橋筋's arch (5 tiles over the arcade's mouth; the posts are solid signs)
function arch(x, y, label, col = '#d62f2f') {
  return {
    type: 'prop', x, y, w: 5, h: 1, solid: false, z: -60,
    draw(ctx, sx, sy) {
      const F = (x0, y0, w, h, cc) => { ctx.fillStyle = cc; ctx.fillRect(x0, y0, w, h); };
      for (const px of [sx + 3, sx + 67]) { F(px, sy - 34, 10, 49, '#3a3f4a'); F(px + 1, sy - 34, 3, 48, '#6a707c'); F(px - 1, sy + 11, 12, 4, '#2a2d36'); }
      F(sx + 1, sy - 46, 78, 16, '#20232a'); F(sx + 2, sy - 45, 76, 14, col); F(sx + 2, sy - 45, 76, 1.5, '#ff8a7a');
      F(sx + 2, sy - 32.5, 76, 1.5, shade(col, -0.35));
      for (let i = 0; i < 18; i++) F(sx + 4 + i * 4.2, sy - 46.5, 1, 1, '#fff3a0');
      text(ctx, label, sx + 40, sy - 43, { size: 10, align: 'center', color: '#fff6e0', shadow: '#5a0010' });
    },
  };
}
const SHOP = (x, w, row, extra) => ({ type: 'building', x, w, ...(row === 'A' ? BAND_A : BAND_B), door: Math.floor(w / 2), ...extra });
function bandEntities() {
  return [
    // ---- row A (doors on row 28, fronts on 千日前通り)
    SHOP(2, 7, 'A', { name: '古着屋 ミナミ', kind: 'boutique', sign: { text: '古着', bg: '#20232a', color: '#f4e6cc' }, text: ['古着屋だ。', 'ヒョウ柄のジャケットに、金色のスニーカー…。\n大阪の古着は、なんだか声が大きい。'] }),
    SHOP(10, 7, 'A', { name: '純喫茶 ドット', kind: 'cafe', wall: '#efe3d0', roof: '#5b3a29', sign: { text: '純喫茶', bg: '#5b3a29', color: '#fff3e0' }, text: ['昔ながらの純喫茶だ。', 'ミックスジュースとホットケーキの食品サンプルが\nショーケースに並んでいる。'] }),
    SHOP(21, 7, 'A', { name: 'ドラッグストア', kind: 'shop', display: 'goods', wall: '#eef6ee', roof: '#2f9a4a', sign: { text: 'ドラッグストア', bg: '#2f9a4a', color: '#ffffff' }, text: ['ドラッグストアだ。', '店先のワゴンに、観光客が群がっている。\n「お一人さま5個まで」の札。'] }),
    SHOP(29, 8, 'A', { name: '靴屋', kind: 'shop', display: 'clothes', wall: '#f2ece0', roof: '#3b3f48', sign: { text: 'シューズ', bg: '#ffffff', color: '#20232a' }, text: ['靴屋だ。', '「歩きやすさ日本一」…と書いてある。\nほんまかいな。'] }),
    SHOP(43, 7, 'A', { name: '洋食 ドット軒', kind: 'restaurant', wall: '#fbf3e4', roof: '#c0392b', sign: { text: '洋食 ドット軒', bg: '#ffffff', color: '#c0392b' }, text: ['老舗の洋食屋だ。', '名物は、ソースたっぷりのオムライス。\nお昼どきは行列ができるらしい。'] }),
    SHOP(51, 8, 'A', { name: '豚まんの店', kind: 'small', wall: '#fff3e0', roof: '#d62f2f', sign: { text: '豚まん', bg: '#d62f2f', color: '#ffffff' }, text: ['豚まんの店だ。', 'せいろから、湯気がもくもく…。\nおみやげに買っていく人が多いらしい。'] }),
    SHOP(64, 12, 'A', { name: 'ドット千日前劇場', kind: 'theater', wall: '#f6e7c8', roof: '#2a3a7a', sign: { text: 'ドット千日前劇場', bg: '#20232a', color: '#ffd23f' }, text: ['千日前の演芸の劇場だ。', '漫才、コント、落語、新喜劇の若手公演…。\n入口の出番表には、知らない名前もたくさん。'] }),
    SHOP(77, 6, 'A', { name: 'お好み焼き', kind: 'small', wall: '#f6e7c8', roof: '#2a3a7a', sign: { text: 'お好み焼き', bg: '#2a3a7a', color: '#ffffff' }, text: ['お好み焼き屋だ。', '鉄板の上で、ソースがじゅうじゅう…。\n「ねぎ焼き」もあるらしい。'] }),
    SHOP(84, 4, 'A', { name: '古本屋', kind: 'bookstore', sign: { text: '古本', bg: '#ffffff', color: '#2a3a7a' }, text: ['古本屋だ。', '昔の演芸雑誌や、劇場のパンフレットが\n一冊百円で売られている。'] }),
    // ---- row B (doors on row 37, fronts on the back lane)
    SHOP(2, 7, 'B', { name: '金券ショップ', kind: 'shop', display: 'goods', wall: '#fff6e0', roof: '#ffd23f', sign: { text: '金券', bg: '#ffd23f', color: '#d62f2f' }, text: ['金券ショップだ。', '新幹線の回数券に、劇場のチケット…。\n少しだけ安く買えるらしい。'] }),
    SHOP(10, 7, 'B', { name: 'たこ焼き 千日前', kind: 'small', wall: '#f6e7c8', roof: '#ff8a3d', sign: { text: 'たこ焼き', bg: '#ff8a3d', color: '#ffffff' }, text: ['もう一軒のたこ焼き屋だ。', 'ここは「ねぎポン酢」が名物らしい。\n…今日は売り切れ。'] }),
    SHOP(21, 6, 'B', { name: '串カツ屋', kind: 'small', wall: '#fff3e0', roof: '#8a5a33', sign: { text: '串カツ', bg: '#ffd23f', color: '#20232a' }, text: '「ソースの二度づけ禁止」の貼り紙がある。開店はまだみたいだ。' }),
    SHOP(28, 9, 'B', { name: 'ドット千日前ホール', kind: 'karaoke', sign: { text: 'お笑いライブ', bg: '#20232a', color: '#ffd23f' }, neon: '#ffd23f', text: ['地下のお笑いライブハウスだ。', '黒板に「本日 若手ネタバトル 18時〜」。\n出番待ちの芸人が、階段に座りこんでいる。'] }),
    SHOP(43, 7, 'B', { name: '100円ショップ', kind: 'shop', display: 'goods', wall: '#f6f6f8', roof: '#d62f2f', sign: { text: '100円', bg: '#d62f2f', color: '#ffffff' }, text: ['100円ショップだ。', 'コントの小道具は、ここでそろえる芸人も多いらしい。'] }),
    SHOP(51, 8, 'B', { name: 'ホビーショップ', kind: 'shop', display: 'goods', wall: '#eef0f6', roof: '#5a4fa0', sign: { text: 'ホビー', bg: '#5a4fa0', color: '#ffffff' }, text: ['ホビーショップだ。', 'プラモデルにフィギュア、レトロゲーム…。\nガラスケースの前で、大人が真剣な顔をしている。'] }),
    SHOP(64, 6, 'B', { name: '居酒屋 ほろ酔い亭', kind: 'small', wall: '#f4e6cc', roof: '#3a2a20', sign: { text: '居酒屋', bg: '#2a3a7a', color: '#ffffff' }, text: ['居酒屋だ。', '「どて焼き」「土手煮」…\nにぎやかな笑い声が聞こえる。'] }),
    SHOP(71, 6, 'B', { name: '寿司 ドット', kind: 'small', wall: '#f6f2e8', roof: '#3a3a40', sign: { text: '寿司', bg: '#ffffff', color: '#20232a' }, text: ['立ち食い寿司の店だ。', '「本日のおすすめ：トロ・はまち・穴子」'] }),
    SHOP(78, 9, 'B', { name: 'ビジネスホテル', kind: 'hotel', rise: 1, wall: '#e8e4dc', roof: '#4a5568', sign: { text: 'HOTEL ミナミ', bg: '#1d2a5e', color: '#ffffff' }, text: ['ビジネスホテルだ。', '「本日満室」の札が出ている。\n泊まるなら、川の北のドットホテルへ。'] }),
    // ---- signs, the arch, the taxi stand
    arch(38, BAND, '戎橋筋'),
    { type: 'sign', x: 38, y: BAND, solid: true, text: ['「戎橋筋」のアーチだ。', 'ことぶき橋から南へ、なんば駅までまっすぐの\nアーケードの商店街。'] },
    { type: 'sign', x: 42, y: BAND, solid: true, text: ['アーチの柱に、案内図が貼ってある。', '【戎橋筋】南へまっすぐ なんば駅\n【千日前通り】西：タクシー乗り場・純喫茶・古着\n東：洋食・豚まん・千日前の劇場・お好み焼き'] },
    { type: 'sign', x: 59, y: 30, text: ['「千日前」の道しるべ。', '↑ 川を渡って、テレビ局通り（MBS毎日放送・関西テレビ）\n→ ドット千日前劇場　↓ 駅前・ゲームセンター'] },
    taxi(23, 30, '#2f6fd0', { text: 'タクシーが客待ちをしている。\nここは、千日前通りのタクシー乗り場だ。' }),
    { type: 'sign', x: 26, y: 30, solid: true, text: ['タクシー乗り場', '南：戎橋筋をまっすぐ なんば駅（電車・新幹線のりかえ）\n北：にし橋をわたって NSC大阪校・ドット劇場・よしもと新喜劇 劇場'] },
    // ---- people
    { type: 'npc', id: 'nw_taxi', x: 25, y: 31, dir: 'left', look: { ...LOOKS.guard, hat: '#2f6fd0' }, name: 'タクシー運転手',
      text: ['まいど！ どこまで行きはります？', '…あ、歩いて行けるとこやったら、歩いたほうが安いで。'] },
    { type: 'npc', id: 'nb_yobikomi', x: 41, y: 32, dir: 'left', look: { ...LOOKS.staff, top: '#ffd23f', hat: '#d62f2f' }, name: '呼び込みのお兄さん', fixedDir: true,
      text: ['らっしゃい、らっしゃい！ 戎橋筋の名物やでー！', 'このアーケード、川からなんば駅まで一直線や。\n雨の日でも、傘いらずで行けるんやで。'] },
    { type: 'npc', id: 'nb_flyer', x: 33, y: 38, dir: 'up', look: { ...LOOKS.comedian2, top: '#ff7eb6' }, name: 'チラシ配りの芸人',
      text: ['今夜、ドット千日前ホールでネタバトルやってまーす！', '五百円で、若手が十組！\nウケへんかったら…それも見どころです！'] },
    { type: 'npc', id: 'nb_tourist', x: 47, y: 30, dir: 'down', look: { ...LOOKS.tourist, top: '#8fd0ff' }, name: '観光客', wander: 3,
      text: ['豚まんとたこ焼きと串カツ、どれから食べよう？', '大阪は「食い倒れ」の街なんだって！'] },
    { type: 'npc', id: 'nb_obachan2', x: 15, y: 30, dir: 'right', look: { ...LOOKS.oldwoman, top: '#ffd23f', hairColor: 'purple' }, name: '買い物中のおばちゃん', wander: 2,
      text: ['あんた、ええ顔してるなあ！ 芸人さん？', 'ちゃうの？ ほな、これからなったらええやん！'] },
    { type: 'npc', id: 'nb_geki_fan', x: 70, y: 30, dir: 'up', look: { ...LOOKS.fan, top: '#ffa860' }, name: 'お笑いファン',
      text: ['千日前の劇場は、若手の登竜門なんやで。', 'ここでウケた子は、ほんまに売れていくんよ。'] },
    { type: 'npc', id: 'nb_park', x: 97, y: 32, dir: 'down', look: { ...LOOKS.oldman, top: '#2f6b4f' }, name: '散歩のおじいさん', wander: 2,
      text: ['ここの公園、春は桜がきれいでなあ。', '川の向こうはテレビ局。\nこっちは千日前。…大阪の真ん中やで。'] },
  ];
}

// Door fronts, the start and the map app's arrival: where a game that has never been here
// since the town grew arrives (a player standing anywhere else is on an old save's spot).
function arrivals(m) {
  const pts = new Set(['22,30']);
  const st = m.place && m.place.start;
  if (st) pts.add(`${st.x},${st.y}`);
  for (const e of (m.room && m.room.entities) || []) {
    if (e.type !== 'building' || !(e.place || e.enter)) continue;
    pts.add(`${e.x + (e.door ?? Math.floor(e.w / 2))},${e.y + e.h}`);
  }
  return pts;
}
// A ?test=1 start is a fresh game placed on today's coordinates.
const testStart = () => { try { return /[?&]test=/.test(window.location.search); } catch (e) { return false; } };
// flags.map_namba: 2 = moved east by OX (the west part), 3 = also moved south by DS (the band, R9-A).
async function nambaEnter(g) {
  const m = g.map, p = m && m.player;
  const v = Number(g.state && g.state.flags && g.flag('map_namba')) || 0;
  if (p && g.state && g.state.flags && v < 3) {
    if (!testStart() && !arrivals(m).has(`${p.x},${p.y}`)) {
      if (v < 2 && p.x + OX < NAMBA_W - 1) Object.assign(p, { x: p.x + OX, px: (p.x + OX) * TILE, tx: p.x + OX });
      if (p.y >= BAND && p.y + DS < NAMBA_H - 1) Object.assign(p, { y: p.y + DS, py: (p.y + DS) * TILE, ty: p.y + DS });
    }
    g.setFlag('map_namba', 3);
    if (typeof m.updateCamera === 'function') m.updateCamera(true);
  }
  unstick(g);
}

registerPlace({
  id: 'namba',
  name: 'なんばエリア（大阪）',
  kind: 'town',
  bgm: 'osaka',
  start: { room: 'main', x: EKI.x, y: EKI.y, dir: 'down' }, // in front of なんば駅
  rooms: {
    main: { generate, bg: '#a9adb7', onEnter: nambaEnter },
  },
});
