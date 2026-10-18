// なんばエリア (大阪): the home of comedy. Reached from 東京駅 (shinkansen to 新大阪, then a local train).
// West part (x 1..42): theatres, the canal and the station. East part (x 43..74, a
// fictional riverside district): テレビ局通り with MBS毎日放送 ('mbs') and 関西テレビ ('ktv')
// on the north bank (js/places/osaka_tv.js), food stalls and おうぎの森公園 on the south bank.

import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { grid, set, put, fill, border } from './townkit.js';
import { commuterTrain, fountain, streetStage } from './props.js';
import { text } from '../engine/draw.js';
import { makeCanvas, fmtMoney } from '../engine/util.js';
import { outline } from '../engine/tiles.js';

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

export const NAMBA_W = 76;   // x 43..74: the riverside テレビ局通り (added later; x 0..43 kept as before)
export const NAMBA_H = 38;

function generate() {
  const W = NAMBA_W, H = NAMBA_H;
  const c = grid(W, H, 'stone');

  // canal with railings and two bridges
  for (let x = 1; x < W - 1; x++) {
    const bridge = (x >= 9 && x <= 11) || (x >= 30 && x <= 32) || (x >= 59 && x <= 61);
    for (let y = 16; y <= 18; y++) set(c, x, y, bridge ? 'bridge_v' : 'canal');
    if (!bridge) { put(c, x, 15, 'railing'); put(c, x, 19, 'railing'); }
  }
  // north street
  fill(c, 1, 10, W - 2, 5, 'brick');
  // south arcade street
  fill(c, 1, 20, W - 2, 3, 'brick');
  for (const x of [14, 29]) put(c, x, 23, 'lantern');
  // station plaza + rails
  fill(c, 1, 30, W - 2, 3, 'brick');
  for (let x = 1; x < W - 1; x++) { put(c, x, 33, 'fence'); set(c, x, 34, 'rail'); set(c, x, 35, 'rail'); set(c, x, 36, 'grass'); }
  border(c, 'tree');

  // decorations
  for (const [x, y] of [[2, 10], [15, 10], [17, 10], [26, 10]]) put(c, x, y, 'nobori');
  for (const [x, y] of [[16, 8], [27, 6], [33, 6]]) put(c, x, y, 'lantern');
  put(c, 32, 8, 'kanban_takoyaki');
  for (const [x, y] of [[1, 1], [16, 2], [27, 2], [32, 2], [42, 1]]) put(c, x, y, 'tree');
  put(c, 13, 13, 'bench'); put(c, 36, 13, 'bench');
  put(c, 28, 12, 'vending'); put(c, 14, 30, 'vending');
  for (const [x, y] of [[14, 26], [29, 26]]) put(c, x, y, 'planter');
  put(c, 8, 31, 'bench'); put(c, 36, 31, 'bench');

  // ---- east: テレビ局通り (north bank) and おうぎの森公園 (south bank)
  for (let x = 43; x <= W - 2; x++) put(c, x, 1, x % 3 ? 'tree' : 'bush');
  for (const [x, y] of [[43, 3], [44, 6], [43, 9], [73, 3], [74, 6], [73, 9]]) put(c, x, y, 'tree');
  put(c, 44, 8, 'lantern');
  fill(c, 55, 2, 7, 8, 'grass');
  for (const [x, y] of [[55, 2], [58, 2], [61, 3], [56, 5], [60, 6], [55, 8]]) put(c, x, y, (x + y) % 2 ? 'sakura' : 'tree');
  for (const [x, y] of [[57, 4], [59, 4], [58, 7], [61, 8]]) set(c, x, y, 'flowers');
  put(c, 57, 9, 'bench'); put(c, 59, 9, 'bench');
  for (const x of [46, 53, 64, 71]) put(c, x, 14, 'sakura');
  for (const x of [56, 63]) put(c, x, 10, 'nobori');
  for (const x of [45, 54, 66, 72]) put(c, x, 23, 'lantern');
  // stall corner and the plaza by the station
  fill(c, 43, 26, 11, 4, 'stone');
  put(c, 44, 28, 'bench'); put(c, 45, 28, 'bench'); put(c, 52, 27, 'vending'); put(c, 53, 27, 'trash');
  put(c, 48, 29, 'planter'); put(c, 43, 29, 'planter');
  // the park
  fill(c, 55, 23, 20, 7, 'grass');
  for (let x = 55; x <= 74; x++) set(c, x, 27, 'path');
  for (let y = 23; y <= 29; y++) { set(c, 55, y, 'path'); set(c, 60, y, 'path'); }
  for (const [x, y] of [[57, 24], [72, 23], [68, 25], [74, 29], [57, 29], [70, 29], [65, 29]]) put(c, x, y, (x + y) % 2 ? 'sakura' : 'tree');
  for (const [x, y] of [[58, 25], [67, 24], [73, 25], [62, 29], [66, 28], [71, 28]]) set(c, x, y, 'flowers');
  put(c, 63, 28, 'bench'); put(c, 69, 28, 'bench');

  const entities = [
    { type: 'building', x: 3, y: 2, w: 12, h: 8, door: 6, place: 'shinkigeki', name: 'よしもと新喜劇 劇場', kind: 'theater', wall: '#f6e7c8', roof: '#d62f2f', logo: 'shinkigeki', signH: 34, signW: 44 },
    { type: 'building', x: 18, y: 3, w: 8, h: 7, door: 4, place: 'shochiku', name: '松竹芸能', kind: 'office', wall: '#f8f0e8', roof: '#d8101c', logo: 'shochiku', signH: 20, signW: 90 },
    { type: 'building', x: 28, y: 6, w: 4, h: 4, door: 2, place: 'takoyaki', name: 'たこ焼き屋', kind: 'small', wall: '#f6e7c8', roof: '#d62f2f', sign: { text: 'たこ焼き', bg: '#ff8a3d', color: '#ffffff' } },
    { type: 'building', x: 34, y: 2, w: 8, h: 8, door: 4, place: 'hotel', name: 'ドットホテル なんば', kind: 'hotel', wall: '#e8e4f0', roof: '#3a4a7a', sign: { text: 'ドットホテル', bg: '#1d2a5e', color: '#ffd23f' } },
    { type: 'building', x: 16, y: 25, w: 12, h: 5, door: 6, place: 'station_namba', name: 'なんば駅', kind: 'station', wall: '#d8d2c4', roof: '#d62f2f', sign: { text: 'なんば駅', bg: '#ffffff' } },
    { type: 'building', x: 1, y: 23, w: 6, h: 4, door: 3, name: 'お好み焼き屋', kind: 'small', wall: '#f6e7c8', roof: '#2a3a7a', sign: { text: 'お好み焼き', bg: '#2a3a7a', color: '#ffffff' }, text: '「本日は貸切です」と書いてある。ソースのいいにおいがする…！' },
    { type: 'building', x: 7, y: 23, w: 6, h: 4, door: 3, name: '串カツ屋', kind: 'small', wall: '#fff3e0', roof: '#8a5a33', sign: { text: '串カツ', bg: '#ffd23f', color: '#20232a' }, text: '「ソースの二度づけ禁止」の貼り紙がある。開店はまだみたいだ。' },
    { type: 'building', x: 30, y: 23, w: 6, h: 4, door: 3, name: 'ゲームセンター', kind: 'shop', wall: '#2a2d36', roof: '#8a5ac8', stripes: ['#ff7eb6', '#5fd7ff'], sign: { text: 'ゲーム', bg: '#20232a', color: '#5fd7ff' }, text: 'ピコピコ…中からゲームの音が聞こえる。今日はお仕事に集中しよう。' },
    { type: 'building', x: 45, y: 2, w: 10, h: 8, door: 5, place: 'mbs', name: 'MBS毎日放送', kind: 'tower', style: 'glass', wall: '#eef1f6', roof: '#1f5fbf', glass: '#6aa2ec', canopy: '#143f86', sign: { text: 'MBS毎日放送', bg: '#ffffff', color: '#1f5fbf' }, signH: 24 },
    { type: 'building', x: 62, y: 2, w: 11, h: 8, door: 5, place: 'ktv', name: '関西テレビ', kind: 'office', wall: '#f6f1ea', roof: '#e8731c', glass: '#8fc8ec', canopy: '#a24c0c', sign: { text: '関西テレビ', bg: '#ffffff', color: '#e8731c' }, signH: 24, plants: true },
    { type: 'building', x: 44, y: 23, w: 4, h: 3, door: 2, name: 'いか焼き屋台', kind: 'small', wall: '#f6e7c8', roof: '#2a3a7a', sign: { text: 'いか焼き', bg: '#ffffff', color: '#2a3a7a' }, talk: ikayaki },
    { type: 'building', x: 49, y: 23, w: 4, h: 3, door: 2, name: 'ミックスジュース', kind: 'small', wall: '#fff6e0', roof: '#ff8a3d', sign: { text: 'ジュース', bg: '#ffd23f', color: '#d62f2f' }, talk: mixJuice },
    streetStage(62, 24, 4, { z: -40 }),
    riverBoat(33, 58, 16),
    { type: 'sign', x: 58, y: 15, solid: true, text: ['テレビ局通り', '北：MBS毎日放送・関西テレビ\n南：いか焼き・ミックスジュース・おうぎの森公園\n西：よしもと新喜劇 劇場・松竹芸能・なんば駅'] },
    { type: 'building', x: 36, y: 23, w: 6, h: 4, door: 3, name: 'おみやげ屋', kind: 'shop', wall: '#ffffff', roof: '#ffd23f', stripes: ['#d62f2f', '#ffd23f'], sign: { text: 'おみやげ', bg: '#ffffff', color: '#d62f2f' }, text: '「ただいま棚卸し中」の札がかかっている。' },
    neon(5, 13, 'なんば', '#ff4f8b'),
    neon(24, 13, 'お笑い', '#5fd7ff'),
    neon(39, 13, 'グルメ', '#ffd23f'),
    commuterTrain(4, 34, { text: undefined }),
    { type: 'sign', x: 8, y: 33, text: 'フェンスの向こうに、電車が停まっている。\n東京へは、駅のきっぷ売り場へ。\n（新大阪で新幹線に乗りかえ）' },
    fountain(37, 30, { text: '待ち合わせスポットの噴水だ。' }),
    { type: 'sign', x: 12, y: 15, text: ['なんば・ことぶき橋\n北：よしもと新喜劇 劇場・松竹芸能・たこ焼き屋・ホテル\n南：なんば駅', '東：川ぞいの「テレビ局通り」\n（MBS毎日放送・関西テレビ）'] },

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

  return { w: W, h: H, cells: c, entities };
}

registerPlace({
  id: 'namba',
  name: 'なんばエリア（大阪）',
  kind: 'town',
  bgm: 'osaka',
  start: { room: 'main', x: 22, y: 30, dir: 'down' },
  rooms: {
    main: { generate, bg: '#a9adb7' },
  },
});
