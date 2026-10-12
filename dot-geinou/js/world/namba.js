// なんばエリア (大阪): the home of comedy. Reached by shinkansen from 東京駅.

import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { grid, set, put, fill, border } from './townkit.js';
import { train, fountain } from './props.js';

export const NAMBA_W = 44;
export const NAMBA_H = 38;

function generate() {
  const W = NAMBA_W, H = NAMBA_H;
  const c = grid(W, H, 'stone');

  // canal with railings and two bridges
  for (let x = 1; x < W - 1; x++) {
    const bridge = (x >= 9 && x <= 11) || (x >= 30 && x <= 32);
    for (let y = 16; y <= 18; y++) set(c, x, y, bridge ? 'bridge_v' : 'canal');
    if (!bridge) { put(c, x, 15, 'railing'); put(c, x, 19, 'railing'); }
  }
  // north street
  fill(c, 1, 10, W - 2, 5, 'brick');
  // south arcade street
  fill(c, 1, 20, W - 2, 4, 'brick');
  for (let x = 1; x < W - 1; x += 4) put(c, x, 24, 'lantern');
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
  for (const [x, y] of [[3, 25], [12, 25], [31, 25], [40, 25]]) put(c, x, y, 'planter');
  put(c, 8, 31, 'bench'); put(c, 36, 31, 'bench');

  const entities = [
    { type: 'building', x: 3, y: 2, w: 12, h: 8, door: 6, place: 'shinkigeki', name: 'よしもと新喜劇 劇場', kind: 'theater', wall: '#f6e7c8', roof: '#d62f2f', logo: 'shinkigeki', signH: 34, signW: 44 },
    { type: 'building', x: 18, y: 3, w: 8, h: 7, door: 4, place: 'shochiku', name: '松竹芸能', kind: 'office', wall: '#f8f0e8', roof: '#d8101c', logo: 'shochiku', signH: 20, signW: 90 },
    { type: 'building', x: 28, y: 6, w: 4, h: 4, door: 2, place: 'takoyaki', name: 'たこ焼き屋', kind: 'small', wall: '#f6e7c8', roof: '#d62f2f', sign: { text: 'たこ焼き', bg: '#ff8a3d', color: '#ffffff' } },
    { type: 'building', x: 34, y: 2, w: 8, h: 8, door: 4, place: 'hotel', name: 'ドットホテル なんば', kind: 'hotel', wall: '#e8e4f0', roof: '#3a4a7a', sign: { text: 'ドットホテル', bg: '#1d2a5e', color: '#ffd23f' } },
    { type: 'building', x: 16, y: 25, w: 12, h: 5, door: 6, place: 'station_namba', name: 'なんば駅', kind: 'station', wall: '#d8d2c4', roof: '#d62f2f', sign: { text: 'なんば駅', bg: '#ffffff' } },
    { type: 'building', x: 2, y: 20, w: 6, h: 4, door: 3, name: 'お好み焼き屋', kind: 'small', wall: '#f6e7c8', roof: '#2a3a7a', sign: { text: 'お好み焼き', bg: '#2a3a7a', color: '#ffffff' }, text: '「本日は貸切です」と書いてある。いいにおいがする…！' },
    { type: 'building', x: 35, y: 20, w: 6, h: 4, door: 3, name: 'おみやげ屋', kind: 'shop', wall: '#ffffff', roof: '#ffd23f', stripes: ['#d62f2f', '#ffd23f'], sign: { text: 'おみやげ', bg: '#ffffff', color: '#d62f2f' }, text: '「ただいま棚卸し中」の札がかかっている。' },
    train(4, 34),
    fountain(37, 30, { text: '待ち合わせスポットの噴水だ。' }),
    { type: 'sign', x: 12, y: 15, text: 'なんば・ことぶき橋\n北：よしもと新喜劇 劇場・松竹芸能・たこ焼き屋・ホテル\n南：なんば駅' },

    { type: 'npc', id: 'obachan', x: 12, y: 21, dir: 'down', look: { ...LOOKS.oldwoman, top: '#ff7eb6', hairColor: 'purple' }, name: '大阪のおばちゃん', talk: async (g, npc) => {
      if (!g.flag('ame_' + g.state.day)) {
        g.setFlag('ame_' + g.state.day);
        await g.say(['あら、あんた見ない顔やね！東京から来たん？', 'ほな、アメちゃんあげるわ！のどにええで〜。'], { name: npc.name, look: npc.look });
        g.giveItem('nodoame');
        g.sfx('coin');
      } else {
        await g.say(['今日のアメちゃんはもうあげたで！', 'また明日おいで〜。'], { name: npc.name, look: npc.look });
      }
    } },
    { type: 'npc', id: 'barker', x: 9, y: 11, dir: 'down', look: { ...LOOKS.staff, hat: '#d62f2f', top: '#d62f2f' }, name: '劇場の呼び込み', text: ['よしもと新喜劇、本日も公演中やでー！', '新喜劇といえば、みんなでそろってズッコケるのがお約束や！', 'よしもとの芸人さんなら舞台に立てるチャンスもあるらしいで。'] },
    { type: 'npc', id: 'shochiku_young', x: 24, y: 12, dir: 'down', look: { ...LOOKS.comedian, top: '#d8101c', hairColor: 'black' }, name: '若手芸人', wander: 2, text: ['松竹芸能は大阪に本社がある老舗の芸能事務所なんや。', 'しゃべりの腕を磨きたいんやったら、オーディション受けてみたらええ。'] },
    { type: 'npc', id: 'tako_fan', x: 30, y: 11, dir: 'up', look: LOOKS.kid, name: 'こども', text: ['ここのたこ焼き、外はカリッと中はトロ〜やで！', '食べたら元気モリモリや！'] },
    { type: 'npc', id: 'namba_tourist', x: 22, y: 21, dir: 'down', look: LOOKS.tourist, name: '観光客', wander: 3, text: ['Osaka is so fun! みんな話しかけてくれるよ！', '川沿いの看板がすごくカラフルだね！'] },
    { type: 'npc', id: 'station_staff', x: 19, y: 31, dir: 'down', look: LOOKS.guard, name: '駅員さん', text: ['なんば駅へようこそ！', '東京へ戻るときは、駅の中の窓口できっぷを買ってくださいね。'] },
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
