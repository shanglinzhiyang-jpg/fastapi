// 大阪の駅前 (owner: R9-B1): 梅田（大阪駅）・新世界（動物園前駅）. Built with js/world/ekimae.js. Real places and
// landmarks; every shop, venue and person here is fictional. Era facts (checked 2026-10): 梅田スカイビル 1993-03;
// 赤い観覧車のあるビル 1998-11; 大阪ステーションシティ 2011-05; グランフロント大阪 2013-04; 通天閣（二代目）1956-;
// 串カツの「ソースの二度づけ禁止」.

import { ageOf } from '../engine/profile.js';
import { ekimae, npc, LOOKS, yearOf, ymOf, eatery, shop, sight, postSign, tower, wheel } from './ekimae.js';

const F = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const B = (x, y, w, h, kind, name, look, talk, extra = {}) => ({ type: 'building', x, y, w, h, kind, name, ...look, ...(typeof talk === 'function' ? { talk } : talk ? { text: talk } : {}), ...extra });
const ok30 = (g) => !!g.state.agency || g.state.fame >= 30;
const adult = (g) => { try { const a = ageOf(g.state); return !(Number.isFinite(a) && a < 20); } catch (e) { return true; } };

const SKYBLDG = { cond: (g) => ymOf(g) >= 199303, draw: (ctx, sx, by) => { for (const dx of [0, 14]) { F(ctx, sx + 120 + dx, by - 28, 9, 28, '#a8b4c8'); for (let wy = by - 26; wy < by - 2; wy += 3) F(ctx, sx + 121 + dx, wy, 7, 1, '#c8d4e4'); } F(ctx, sx + 118, by - 31, 27, 4, '#b8c4d4'); F(ctx, sx + 126, by - 29, 11, 6, '#e8eef6'); } };
const GRAND = { cond: (g) => ymOf(g) >= 201304, draw: (ctx, sx, by) => { for (const [x, h] of [[300, 30], [318, 26], [336, 29]]) { F(ctx, sx + x, by - h, 14, h, '#8e9cb4'); for (let wy = by - h + 2; wy < by - 2; wy += 3) F(ctx, sx + x + 1, wy, 12, 1, '#b4c0d4'); } } };

// ======================================================================== 梅田（大阪駅）
ekimae({
  id: 'osaka_umeda', name: '梅田（大阪）', station: 'umeda', region: 'osaka', rail: 'ground', W: 48, H: 31, rotary: 30,
  look: { wall: '#e8ecf0', roof: '#5a6a80' }, bgm: 'osaka',
  skyline: [SKYBLDG, GRAND],
  intro: (g) => ['大阪駅（梅田）の前に出た。', ymOf(g) >= 199811 ? '赤い観覧車が、ビルの上で回っている！' : '高いビルがいくつも並ぶ、大阪のキタの玄関口だ。'],
  guide: { name: '梅田（大阪駅前）', short: '梅田', hint: '大阪の電車で梅田へ（ドット環状線（大阪）・御堂筋線）', lines: ['地下街のグルメ・お好み焼き・大きな本屋', '観覧車のあるビル（1998年から）', 'なんばへは御堂筋線ですぐ'] },
  exitNote: ['大阪駅前（梅田）の案内板だ。', '左：地下街の入口・本屋　右：バスのりば・観覧車のビル\n南：お好み焼き・路地の神社'],
  paint(K) {
    const { fill, put, vroad } = K;
    vroad(20, 21, 29);
    fill(1, 27, 46, 3, 'brick');
    for (const x of [3, 14, 33, 44]) put(x, 20, 'lamp');
    for (const x of [2, 8, 14]) put(x, 9, 'tree');
  },
  entities: (K) => [
    B(31, 5, 12, 6, 'office', '観覧車のあるビル', { wall: '#d8202a', roof: '#a8101a', sign: { text: 'ファッションビル', bg: '#ffffff', color: '#d8202a' } }, (g) => ferris(g), { cond: (g) => ymOf(g) >= 199811 }),
    wheel(36, 5, 30, '#e8303a', { cond: (g) => ymOf(g) >= 199811 }),
    B(31, 5, 12, 6, 'office', '百貨店', { wall: '#e8e0d0', roof: '#6a4a3a', sign: { text: '百貨店', bg: '#6a4a3a', color: '#ffffff' } }, ['大きな百貨店だ。', '大阪の人は「ちょっと梅田まで」と言って、ここに買い物に来る。'], { cond: (g) => ymOf(g) < 199811 }),
    B(1, 10, 9, 6, 'small', '地下街の入口', { wall: '#e8ecf2', roof: '#2a4a8a', sign: { text: '地下街', bg: '#2a4a8a', color: '#ffffff' } }, (g) => chikagai(g)),
    B(11, 10, 6, 6, 'shop', '大きな本屋', { wall: '#ffffff', roof: '#2a3a7a', sign: { text: '本屋', bg: '#2a3a7a', color: '#ffffff' } }, (g) => shop(g, { greet: '大きな本屋だ。お笑いの本のコーナーもある。', items: [{ name: 'お笑いの雑誌', price: 600, item: 'wadai', text: '芸人のインタビューがたっぷり。トークのネタになりそうだ。' }, { name: 'ネタ帳（ノート）', price: 300, item: 'netacho', text: '新しいネタ帳を買った。' }] })),
    B(2, 21, 8, 6, 'small', 'お好み焼き屋', { wall: '#f6e7c8', roof: '#2a3a7a', sign: { text: 'お好み焼き', bg: '#2a3a7a', color: '#ffffff' } }, (g) => eatery(g, { greet: '「いらっしゃい！　鉄板、あったまってるで！」', items: [{ name: '豚玉', price: 900, heal: 35, fill: 40, stress: 3, text: 'ヘラで切って、ハフハフ…うまい！', minutes: 30 }, { name: 'ミックス焼き', price: 1300, heal: 45, fill: 50, stress: 4, text: 'いか、えび、豚。ぜいたくな一枚！', minutes: 35 }] })),
    B(11, 21, 7, 6, 'theater', '路地の神社', { wall: '#e8d8b8', roof: '#3a4a3a', sign: { text: '神社', bg: '#a8202a', color: '#ffffff' } }, (g) => sight(g, 'umeda_jinja', ['ビルの谷間の、小さな神社だ。', '恋の願いごとの絵馬が、たくさん結ばれている。'], 3, 10)),
    B(25, 21, 8, 6, 'restaurant', '洋食屋', { wall: '#fff6e8', roof: '#8a3a2a', sign: { text: '洋食', bg: '#8a3a2a', color: '#ffffff' } }, (g) => eatery(g, { greet: '「いらっしゃいませ。名物のオムライスです」', items: [{ name: 'オムライス', price: 1000, heal: 35, fill: 35, stress: 3, text: 'ふわふわの卵に、デミグラスソース。', minutes: 30 }] })),
    B(36, 21, 10, 6, 'office', 'オフィスビル', { wall: '#c8d0dc', roof: '#3a4a6a', sign: { text: 'ドット梅田ビル', bg: '#ffffff' } }, (g) => g.say([ymOf(g) >= 201304 ? '駅の北側に、新しいビル街ができた。' : 'オフィスビルだ。お昼どきは、地下街の店に行列ができる。', '大阪のテレビ局や新聞社も、このあたりに多い。'])),
    npc('um_oba', 18, 10, 'down', { ...LOOKS.oldwoman, top: '#ff7eb6', hairColor: 'purple' }, '大阪のおばちゃん', ['梅田の地下街は、慣れてる人でも迷うんよ。', 'わからんかったら、だれかに聞き！　大阪の人は、みんな教えてくれるで。'], { wander: 2 }),
    npc('um_biz', 34, 16, 'left', { ...LOOKS.salaryman, top: '#3a4a6a' }, '大阪の会社員', ['JRは「大阪駅」、地下鉄と私鉄は「梅田駅」。', '名前はちゃうけど、同じところやねん。'], { wander: 1 }),
    npc('um_geinin', 24, 28, 'up', { ...LOOKS.comedian, top: '#ffd23f' }, '若手芸人', ['なんばの劇場の帰りや。', 'キタの梅田、ミナミのなんば。地下鉄ですぐやで！'], { wander: 2 }),
    npc('um_tourist', 6, 18, 'up', LOOKS.tourist, '観光客', (g) => [ymOf(g) >= 199811 ? 'ビルの上の観覧車、乗ってみたい！' : '大阪の高いビルから、街を見下ろしてみたいな。', '大阪城にも行ってみたいんだ。'], { wander: 1 }),
  ],
});
async function ferris(g) {
  const i = await g.ask('ビルの屋上の、赤い観覧車だ。（¥600）', ['乗る', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(600)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin'); g.relax({ stress: 8 });
  if (typeof g.advanceTime === 'function') g.advanceTime(20, '観覧車');
  await g.say(['ゴンドラがゆっくり上がっていく…。', '大阪の街が、ぐるっと見渡せた。（ストレス-8）']);
}
async function chikagai(g) {
  const items = [{ name: 'カレーライス', price: 800, heal: 30, fill: 35, stress: 2, text: '地下街の名物カレー。甘くて、あとから辛い！', minutes: 20 }, { name: 'たこ焼き', price: 500, heal: 20, fill: 20, stress: 3, text: '外はカリッ、中はとろっ。', minutes: 10 }];
  await eatery(g, { greet: '梅田の地下街だ。飲食店がずらりと並んでいる。', items });
}

// ======================================================================== 新世界（動物園前駅）
ekimae({
  id: 'osaka_shinsekai', name: '新世界（大阪）', station: 'dobutsuen', region: 'osaka', rail: 'under', W: 48, H: 31, rotary: null, sx: 2,
  bgm: 'osaka',
  skyline: [],
  intro: ['動物園前駅の出口を出ると、そこは新世界。', '通天閣がそびえ、ネオンと看板がひしめいている！'],
  guide: { name: '新世界', short: '新世界', hint: '御堂筋線の動物園前駅（なんばから二駅）', lines: ['通天閣（展望台）・串カツ屋（二度づけ禁止）', '大衆劇場「新世界ドット劇場」：観る・出演する（所属か★30）', '将棋の店・スマートボール・動物園'] },
  exitNote: ['新世界の案内板だ。', '北：通天閣　右：串カツ・劇場・将棋　南：動物園の入口'],
  signAt: [5, 10],
  paint(K) {
    const { fill, set, put } = K;
    fill(1, 5, 46, 11, 'brick');
    for (const x of [15, 21, 27, 33]) put(x, 15, 'lantern');
    fill(1, 21, 46, 9, 'stone');
    fill(1, 27, 20, 3, 'grass');
    for (const [x, y] of [[2, 28], [6, 28], [10, 28], [14, 28], [18, 28]]) put(x, y, 'tree');
    for (const x of [3, 23, 43]) put(x, 20, 'lamp');
  },
  entities: (K) => [
    tower(16, 9, 4, 'tsutenkaku', { talk: (g) => tsutenkaku(g) }),
    { type: 'sign', x: 17, y: 11, solid: true, text: ['通天閣の足もとだ。', '展望台へのエレベーターは、この下から。'] },
    B(24, 3, 7, 5, 'small', 'ふぐ料理', { wall: '#f4e6cc', roof: '#2a3a7a', sign: { text: 'ふぐ', bg: '#2a3a7a', color: '#ffffff' } }, (g) => eatery(g, { greet: '大きなふぐのちょうちんが目じるしの店だ。', items: [{ name: 'てっちり（ふぐ鍋）', price: 3000, heal: 40, fill: 40, stress: 6, text: 'ぷりぷりのふぐに、ポン酢。しめは雑炊！', minutes: 60 }] })),
    B(32, 3, 6, 5, 'small', 'たこ焼き屋', { wall: '#f6e7c8', roof: '#d62f2f', sign: { text: 'たこ焼き', bg: '#ff8a3d', color: '#ffffff' } }, (g) => eatery(g, { greet: '「焼きたてやで〜！」', items: [{ name: 'たこ焼き 8個', price: 500, heal: 20, fill: 20, stress: 3, text: '外はカリッ、中はトロッ。', minutes: 10 }] })),
    B(39, 3, 8, 5, 'shop', 'ゲームセンター', { wall: '#2a2d36', roof: '#8a5ac8', stripes: ['#ff7eb6', '#5fd7ff'], sign: { text: 'ゲーム', bg: '#20232a', color: '#5fd7ff' } }, (g) => sight(g, 'shinsekai_game', ['昔ながらのゲームセンターだ。', 'レトロな筐体で、一回だけ遊んだ。'], 3, 15)),
    B(24, 9, 6, 6, 'small', '串カツ屋', { wall: '#fff3e0', roof: '#8a5a33', sign: { text: '串カツ', bg: '#ffd23f', color: '#20232a' } }, (g) => kushikatsu(g)),
    B(31, 9, 9, 6, 'theater', '新世界ドット劇場', { wall: '#f6e7c8', roof: '#a8202a', sign: { text: 'ドット劇場', bg: '#a8202a', color: '#ffe48a' } }, (g) => taishu(g)),
    B(41, 9, 6, 6, 'small', '将棋の店', { wall: '#efe2c8', roof: '#3a2a20', sign: { text: '将棋', bg: '#3a2a20', color: '#ffffff' } }, (g) => shogi(g)),
    B(2, 21, 7, 5, 'shop', 'スマートボール', { wall: '#2a2d36', roof: '#ff8a3d', stripes: ['#ff8a3d', '#ffd23f'], sign: { text: 'スマート', bg: '#20232a', color: '#ffd23f' } }, (g) => smartball(g)),
    B(10, 21, 7, 5, 'small', '射的', { wall: '#f4e6cc', roof: '#a8202a', sign: { text: '射的', bg: '#a8202a', color: '#ffffff' } }, (g) => sight(g, 'shateki', ['コルクの鉄砲で、景品をねらう。（¥300）', 'パン！…おしい、ちょっとかすっただけ。'], 3, 10)),
    B(24, 21, 9, 5, 'small', 'ホルモン屋', { wall: '#f4e6cc', roof: '#3a2a20', sign: { text: 'ホルモン', bg: '#d62f2f', color: '#ffffff' } }, (g) => eatery(g, { greet: '「どて焼き、ええ感じに煮えてるで」', items: [{ name: 'どて焼き', price: 500, heal: 15, fill: 15, stress: 3, text: '甘辛い白みそで、とろとろに煮こんだすじ肉。', minutes: 15 }] })),
    B(36, 21, 10, 5, 'office', '動物園の入口', { wall: '#f4ecd8', roof: '#2f8a4a', sign: { text: '動物園', bg: '#2f8a4a', color: '#ffffff' } }, (g) => zoo(g)),
    { type: 'prop', x: 20, y: 13, w: 1, h: 1, solid: true, text: ['足の裏をなでると、願いがかなうという福の神の像だ。', '（そっと足の裏をなでた）'],
      draw(ctx, sx, sy) { F(ctx, sx + 2, sy + 6, 12, 9, '#c8a060'); F(ctx, sx + 3, sy - 6, 10, 13, '#e8c070'); F(ctx, sx + 4, sy - 12, 8, 7, '#e8c070'); F(ctx, sx + 6, sy - 10, 1, 1, '#20232a'); F(ctx, sx + 9, sy - 10, 1, 1, '#20232a'); F(ctx, sx + 6, sy - 7, 4, 1, '#8a5a20'); F(ctx, sx + 2, sy + 14, 12, 1, '#8a6a30'); } },
    npc('ss_oyaji', 22, 16, 'down', { ...LOOKS.oldman, top: '#5a6f8a' }, '新世界のおっちゃん', ['通天閣はな、大阪のシンボルや。', '串カツのソース、二度づけしたらあかんで！　キャベツですくうんや。'], { wander: 2 }),
    npc('ss_tourist', 12, 16, 'up', { ...LOOKS.tourist, top: '#ffd23f' }, '観光客', ['ネオンがすごい！　看板もぜんぶ大きい！', 'フグのちょうちんの看板、写真に撮らなきゃ。'], { wander: 2 }),
    npc('ss_actor', 35, 16, 'down', { ...LOOKS.actor, top: '#a8202a' }, '大衆演劇の役者', ['昼の部と夜の部、毎日ちがう芝居をやるんや。', '旅から旅の一座やけど、ここの客はあったかいで。'], { wander: 1 }),
    npc('ss_child', 40, 28, 'up', LOOKS.kid, 'こども', ['動物園で、ゾウとキリン見てきた！'], { wander: 2 }),
  ],
});
async function tsutenkaku(g) {
  const i = await g.ask('通天閣だ。展望台にのぼる？（¥1,000）', ['のぼる', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(1000)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin'); g.relax({ stress: 8 });
  if (typeof g.advanceTime === 'function') g.advanceTime(40, '通天閣');
  await g.say(['エレベーターで展望台へ。', '大阪の街が、遠くまで見渡せる。', '展望台には、足の裏をなでると願いがかなう福の神の像があった。（ストレス-8）']);
}
async function kushikatsu(g) {
  const items = [{ name: '串カツ盛り合わせ', price: 1000, heal: 30, fill: 35, stress: 4, text: 'ソースは二度づけ禁止！　キャベツですくって、もう一回。', minutes: 30 }];
  if (adult(g)) items.push({ name: '串カツとビール', price: 1500, heal: 25, fill: 30, stress: 7, text: 'カウンターでとなりのおっちゃんと乾杯。大阪のノリや！', minutes: 45 });
  await eatery(g, { greet: '「らっしゃい！　ソースの二度づけは禁止やで！」', items });
}
async function taishu(g) {
  const i = await g.ask('新世界ドット劇場。大衆演劇の一座が、毎日ちがう芝居をかける。', ['観る（¥1,800）', '舞台に出る（所属か★30・演技）', 'やめておく'], { cancel: 2 });
  if (i === 0) {
    if (!g.spend(1800)) { await g.say('お金が足りない…。'); return; }
    g.sfx('coin'); g.relax({ stress: 12 }); g.addSkill('engi', 1, true);
    if (typeof g.advanceTime === 'function') g.advanceTime(180, '大衆演劇');
    await g.say(['人情芝居に、客席のあちこちからすすり泣き。', '最後は歌と踊りのショーで大盛り上がり！（ストレス-12・演技+1）']);
  } else if (i === 1) {
    if (!ok30(g)) { await g.say(['座長「うちの舞台は、もうちょい名前が売れてからやな」', '（所属するか、知名度★30で出られる）']); return; }
    await g.job({ id: 'eki_shinsekai_stage', title: '新世界ドット劇場の客演', stamina: 22, minigame: 'conte', opts: { difficulty: 2 }, pay: 6000, fame: 12, skill: 'engi', gain: 3, minutes: 240 });
  }
}
async function shogi(g) {
  await sight(g, 'shogi', ['将棋の店だ。おっちゃんたちが、真剣な顔で盤をにらんでいる。', '一局だけ指してもらった。…あっという間に負けた。', 'おっちゃん「筋はええ。読みが浅いだけや」'], 4, 40);
}
async function smartball(g) {
  if (!g.spend(300)) { await g.say('お金が足りない…。（¥300）'); return; }
  g.sfx('coin');
  await sight(g, 'smartball', ['昔ながらのスマートボールだ。（¥300）', 'ころころ…カコン！　白い玉が穴に入った。', 'なつかしい音に、なんだか心がほどけた。'], 4, 15);
}
async function zoo(g) {
  const i = await g.ask('動物園の入口だ。（入園料 ¥500）', ['入る', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(500)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin'); g.relax({ stress: 8 });
  if (typeof g.advanceTime === 'function') g.advanceTime(120, '動物園');
  await g.say(['ゾウ、キリン、ペンギン…。', '園の向こうに、通天閣が見える。（ストレス-8）']);
}
export const OSAKA_AREAS = ['osaka_umeda', 'osaka_shinsekai'];
