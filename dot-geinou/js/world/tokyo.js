// 東京エリア: the main town. Most agencies and TV stations are here.

import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { grid, set, put, fill, hroad, vroad, border } from './townkit.js';
import { fountain, train, taxi, busStop, streetStage, statue } from './props.js';

export const TOKYO_W = 60;
export const TOKYO_H = 46;

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

function generate() {
  const W = TOKYO_W, H = TOKYO_H;
  const c = grid(W, H, 'grass');

  // ---- roads
  hroad(c, 20, 1, W - 2);
  vroad(c, 19, 1, H - 2);
  vroad(c, 39, 1, H - 2);
  for (const x of [17, 23, 37, 43]) for (let y = 20; y <= 22; y++) set(c, x, y, 'crosswalk_h');
  for (const y of [17, 25]) for (const x0 of [19, 39]) for (let x = x0; x < x0 + 3; x++) set(c, x, y, 'crosswalk_v');
  border(c, 'tree');

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
  for (let x = 43; x <= 57; x++) { put(c, x, 37, 'fence'); set(c, x, 38, 'rail'); set(c, x, 39, 'rail'); }
  for (let x = 43; x <= 57; x++) if (x % 3 === 0) put(c, x, 41, 'tree');
  put(c, 44, 33, 'planter'); put(c, 56, 33, 'planter');
  put(c, 46, 35, 'bench');

  // ---- street furniture
  for (const x of [6, 13, 27, 33, 47, 53]) { put(c, x, 19, 'lamp'); put(c, x, 23, 'lamp'); }
  for (const y of [6, 13, 30, 36]) { put(c, 18, y, 'lamp'); put(c, 42, y, 'lamp'); }
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
    { type: 'building', x: 11, y: 25, w: 6, h: 4, door: 3, place: 'konbini', name: 'ドットマート', kind: 'shop', wall: '#f6f6f8', roof: '#e8eaee', stripes: ['#2f9a4a', '#ff8a3d', '#2f6fd0'], sign: { text: 'ドットマート', bg: '#ffffff', color: '#2f6fd0' } },
    { type: 'building', x: 23, y: 25, w: 8, h: 7, door: 4, place: 'yoshimoto', name: 'よしもと 東京本部', kind: 'office', wall: '#fff3e6', roof: '#e8492a', logo: 'yoshimoto', signH: 30, signW: 30 },
    { type: 'building', x: 32, y: 25, w: 6, h: 6, door: 3, place: 'bs_yoshimoto', name: 'BSよしもと', kind: 'office', wall: '#ffffff', roof: '#ff3b1f', logo: 'bs_yoshimoto', signH: 22, signW: 84 },
    { type: 'building', x: 24, y: 35, w: 7, h: 6, door: 3, place: 'grape', name: 'グレープカンパニー', kind: 'office', wall: '#f3eefa', roof: '#7a4fa0', logo: 'grape', signH: 34, signW: 36 },
    { type: 'building', x: 32, y: 36, w: 6, h: 5, door: 3, place: 'sento', name: '銭湯 ドットの湯', kind: 'bath', wall: '#f6e7c8', roof: '#3b4a6a', sign: { text: 'ゆ', bg: '#2a3a7a', color: '#ffffff', size: 12 } },
    { type: 'building', x: 44, y: 26, w: 12, h: 5, door: 6, place: 'station_tokyo', name: '東京駅', kind: 'station', wall: '#b8644a', roof: '#4a5a70', sign: { text: '東京駅', bg: '#ffffff' } },

    // props
    fountain(8, 13),
    streetStage(6, 34, 4, { solid: false }),
    train(45, 38, { text: undefined }),
    { type: 'sign', x: 50, y: 37, text: 'フェンスの向こうに新幹線が停まっている。乗るなら駅のきっぷ売り場へ。' },
    taxi(48, 33), taxi(51, 33, '#2f9a4a'),
    busStop(55, 32),
    statue(27, 13, { text: '「笑顔は世界をつなぐ」と刻まれた像だ。' }),

    // signs
    { type: 'sign', x: 46, y: 15, text: '東映 撮影所\n本日撮影中！関係者は正面入口へどうぞ。' },
    { type: 'sign', x: 17, y: 18, text: '↑ NHK・ホリプロ・東宝・東映\n↓ よしもと・BSよしもと・グレープカンパニー\n→ 東京駅（新幹線で大阪へ）', solid: true },

    // NPCs
    {
      type: 'npc', id: 'oya', x: 6, y: 30, dir: 'down', look: LOOKS.oldwoman, name: '大家さん',
      text: ['あら{name}ちゃん、おでかけ？', '芸能界で売れたいなら、まずは事務所に所属することね。よしもとさんとか、グレープカンパニーさんとか、ホリプロさんとか…このあたりにいっぱいあるわよ。', '疲れたら部屋のベッドでゆっくり休むのよ。'],
    },
    {
      type: 'npc', id: 'street_comedian', x: 10, y: 36, dir: 'down', look: LOOKS.comedian, name: 'ストリート芸人',
      text: ['よう！ここのステージ、だれでも使ってええんやで。', '事務所に入ってなくても、路上で漫才や歌を披露すれば投げ銭がもらえるんや。', '腕も上がるし、ちょっとずつ顔も売れるで！'],
    },
    { type: 'npc', id: 'park_oldman', x: 12, y: 38, dir: 'left', look: LOOKS.oldman, name: 'おじいさん', wander: 2, text: ['ほっほっほ。この公園の桜は見事じゃろう。', '昔はここで若い芸人さんがよく練習しとったもんじゃ。'] },
    { type: 'npc', id: 'kid', x: 6, y: 40, dir: 'up', look: LOOKS.kid, name: 'こども', wander: 3, text: ['ねえねえ、テレビに出たことある？', 'ぼく、大きくなったら新喜劇みたいにズッコケる人になるんだ！'] },
    { type: 'npc', id: 'scout', x: 45, y: 24, dir: 'left', look: LOOKS.manager, name: 'スカウトマン', text: ['君、いい顔してるねえ…でも残念、うちは今は募集してないんだ。', '大阪のなんばには「よしもと新喜劇」の劇場や「松竹芸能」があるよ。', '東京駅から新幹線で新大阪へ行って、電車に乗りかえればすぐさ。'] },
    { type: 'npc', id: 'salaryman', x: 30, y: 19, dir: 'right', look: LOOKS.salaryman, name: 'サラリーマン', wander: 3, text: ['いやー、昨日のバラエティ番組は笑ったなあ。', 'お笑いの事務所に入りたいなら、よしもと、松竹芸能、グレープカンパニー…いろいろあるねえ。'] },
    { type: 'npc', id: 'fan', x: 28, y: 15, dir: 'up', look: LOOKS.fan, name: 'ファンの子', text: ['ホリプロの前で出待ちしてるの！', 'ホリプロは歌手や俳優さんが多い事務所なんだって。歌や演技に自信があるならオーディションを受けてみたら？'] },
    { type: 'npc', id: 'tourist', x: 10, y: 18, dir: 'up', look: LOOKS.tourist, name: '観光客', wander: 2, text: ['Wow! NHK! テレビ局の中、見学できるのかな？', 'ここでは毎日たくさんの番組が作られているらしいよ。'] },
    { type: 'npc', id: 'extra', x: 50, y: 13, dir: 'down', look: { ...LOOKS.samurai, top: '#8a5a33' }, name: 'エキストラさん', text: ['拙者、本日は時代劇のエキストラでござる…なんてね！', '東映の撮影所では時代劇や特撮ヒーローの撮影をしてるんだ。体力勝負だよ〜。'] },
    { type: 'npc', id: 'young_comedian', x: 29, y: 33, dir: 'left', look: LOOKS.comedian2, name: '若手芸人', text: ['よしもとのオーディション、ツッコミのタイミングが命やで。', 'ボケを最後まで聞いてから、ビシッとツッコむ！早すぎても遅すぎてもアカン。'] },
    { type: 'npc', id: 'grape_fan', x: 33, y: 42, dir: 'up', look: { ...LOOKS.fan, hairColor: 'brown', top: '#9273bd' }, name: 'お笑いファン', wander: 2, text: ['グレープカンパニーの芸人さんのグッズ、買っちゃった！', 'お風呂屋さんの「ドットの湯」は、疲れがとれるって評判だよ。'] },
    { type: 'npc', id: 'taxi_driver', x: 53, y: 34, dir: 'left', look: { ...LOOKS.guard, hat: '#3b3f48' }, name: 'タクシー運転手', text: ['お客さん、芸能人の卵？', '新幹線で大阪まで行けば、お笑いの本場・なんばもすぐそこだよ。運賃はちと高いけどね。'] },
  ];

  return { w: W, h: H, cells: c, entities, events: [{ x: 6, y: 34, w: 4, h: 2, on: 'action', run: streetLive }, { x: 6, y: 36, w: 4, h: 1, on: 'step', run: async (g) => { if (!g.flag('stageHint')) { g.setFlag('stageHint'); await g.say('小さなステージだ。ステージの前でAボタンを押すとパフォーマンスできそうだ。'); } } }] };
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
