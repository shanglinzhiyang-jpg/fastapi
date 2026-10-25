// 東京の駅前 (owner: R9-B1): 渋谷・新宿・上野・浅草・秋葉原・下北沢・調布（ドット自動車教習所）・府中（ドット運転免許センター）.
// Built with js/world/ekimae.js. Real places and landmarks; every shop, venue, company and person here is fictional
// (the 演芸場 / 寄席 / 小劇場 have made-up names). Era facts used (checked 2026-10):
//   東京都庁 新庁舎 開庁 1991-04-01 (built 1988–1991); 東京スカイツリー 開業 2012-05-22 (工事 2008-07–2012-02);
//   小田急線 下北沢 地下化 2013-03-23 (踏切がなくなる); 京王線 調布 地下化 2012-08-19; 上野動物園のパンダ: 1972–,
//   2008-04〜2011-02 は不在, 2026-01-27 に双子が中国へ（国内ゼロ）; 渋谷の大型ビジョン 1999-12-; メイド喫茶 2001-;
//   秋葉原の歩行者天国 2008-06〜2011-01 中止; 中央線快速の土休日通過（高円寺・阿佐ケ谷）.

import { PLACES } from '../engine/map.js';
import { registerItem } from '../engine/state.js';
import { GUIDE } from './guide.js';
import { text } from '../engine/draw.js';
import { ageOf } from '../engine/profile.js';
import {
  ekimae, npc, LOOKS, yearOf, ymOf, eatery, shop, sight, postSign, bigScreen, statueDog, skyline, lanternGate, lanternPillars,
  crossingBarrier, courseCar, groundMark, trainBand,
} from './ekimae.js';

// skyline landmarks (drawn in the two sky rows behind the railway; baseY = their foot)
const TOCHO = { cond: (g) => yearOf(g) >= 1991, draw: (ctx, sx, by) => { for (const dx of [0, 15]) { F(ctx, sx + 560 + dx, by - 28, 10, 28, '#a0a8bc'); F(ctx, sx + 561 + dx, by - 31, 8, 4, '#b0b8ca'); for (let wy = by - 26; wy < by - 2; wy += 3) F(ctx, sx + 561 + dx, wy, 8, 1, '#c8d0e0'); } F(ctx, sx + 570, by - 18, 5, 18, '#98a0b4'); } };
const TOCHO_BUILD = { cond: (g) => yearOf(g) < 1991, draw: (ctx, sx, by) => { F(ctx, sx + 560, by - 12, 26, 12, '#b8bcc6'); F(ctx, sx + 566, by - 30, 1.5, 18, '#e8a020'); F(ctx, sx + 566, by - 30, 20, 1.5, '#e8a020'); F(ctx, sx + 584, by - 30, 1, 6, '#5a5f6b'); } };
const NISHI = { draw: (ctx, sx, by) => { for (const [x, w, h] of [[500, 12, 24], [516, 10, 27], [530, 12, 22], [600, 12, 25], [616, 10, 20]]) { F(ctx, sx + x, by - h, w, h, '#8a94aa'); for (let wy = by - h + 2; wy < by - 2; wy += 3) F(ctx, sx + x + 1, wy, w - 2, 1, '#aab4c8'); } } };
const SKYTREE = { cond: (g) => ymOf(g) >= 200807, draw: (ctx, sx, by, g) => { const done = ymOf(g) >= 201203; const h = done ? 31 : 8 + Math.min(20, (ymOf(g) - 200807) / 2.5); F(ctx, sx + 640, by - h, 3, h, '#c8d4e4'); F(ctx, sx + 640.5, by - h, 1, h, '#eef4fa'); if (done) { F(ctx, sx + 638, by - 22, 7, 2, '#d8e0ec'); F(ctx, sx + 638.5, by - 15, 6, 1.5, '#d8e0ec'); } else F(ctx, sx + 640, by - h - 1, 9, 1, '#e8a020'); } };

const F = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const B = (x, y, w, h, kind, name, look, talk, extra = {}) => ({ type: 'building', x, y, w, h, kind, name, ...look, ...(typeof talk === 'function' ? { talk } : talk ? { text: talk } : {}), ...extra });
const job = (g, def) => g.job({ confirm: true, ...def });
const ok30 = (g) => !!g.state.agency || g.state.fame >= 30;

registerItem('ningyoyaki', { name: '人形焼', price: 600, desc: '浅草のおみやげ。体力が20回復する。', heal: 20 });
registerItem('ameyoko_choco', { name: 'アメ横のチョコ', price: 1000, desc: 'たたき売りで買ったチョコの山。体力が15回復する。', heal: 15 });

// ======================================================================== 渋谷
ekimae({
  id: 'ekimae_shibuya', name: '渋谷', station: 'shibuya', region: 'tokyo', rail: 'elevated', W: 48, H: 31, rotary: 30,
  look: { wall: '#e4e0d4', roof: '#5a6a80' },
  intro: ['渋谷駅前に出た。', '目の前の交差点を、人の波がいっせいに渡っていく…！'],
  skyline: [],
  guide: { name: '渋谷駅前', short: '渋谷', hint: '電車で渋谷駅へ（ドット環状線・ドットメトロ）', lines: ['ハチ公前・スクランブル交差点・ファッションビル', 'レコード店・ライブハウス（歌のステージ）', '時代ごとの若者文化'] },
  exitNote: ['渋谷駅前の案内板だ。', '左：ハチ公前広場・ファッションビル　右：バスのりば\n南：スクランブル交差点の先に、レコード店とライブハウス'],
  paint(K) {
    const { fill, set, put, vroad } = K;
    // the scramble crossing: the street south from the crossing, crosswalks on every side
    vroad(22, 21, 29);
    for (let y = 17; y <= 19; y++) { for (const x of [20, 21, 25, 26]) set(x, y, 'crosswalk_h'); }
    for (let x = 22; x <= 24; x++) set(x, 21, 'crosswalk_v');
    fill(1, 27, 46, 3, 'brick');
    // ハチ公前広場: trees around the plaza
    for (const x of [2, 6, 10]) put(x, 9, 'tree');
    put(14, 9, 'planter'); put(13, 12, 'bench'); put(15, 12, 'bench');
    for (const x of [3, 9, 15, 29, 35, 41]) put(x, 20, 'lamp');
  },
  entities: (K) => [
    statueDog(16, 10, { talk: (g) => sight(g, 'hachiko', ['犬の銅像だ。渋谷の待ち合わせの目じるし。', '今日も、だれかがだれかを待っている。'], 2, 5) }),
    B(1, 11, 9, 5, 'office', 'ファッションビル', { wall: '#f4f2ee', roof: '#c0c4cc', sign: { text: 'ファッションビル', bg: '#20232a', color: '#ffffff' } }, (g) => fashion(g)),
    B(31, 5, 12, 6, 'office', '渋谷のビル', { wall: '#d8dce4', roof: '#3a4a6a', sign: { text: 'ドット渋谷ビル', bg: '#ffffff' } }, ['大きなビルだ。', '壁の大きな画面に、新曲のCMが流れている。']),
    bigScreen(33, 5, 8, 3, (g) => (yearOf(g) >= 1999 ? `渋谷の街頭ビジョン ── ${screenWord(g)}` : '看板 ── 新しいレコード、発売中'), { cond: (g) => yearOf(g) >= 1999 }),
    B(2, 21, 8, 6, 'shop', 'レコード店', { wall: '#2a2d36', roof: '#ff4f8b', stripes: ['#ff4f8b', '#5fd7ff'], sign: { text: 'レコード・CD', bg: '#20232a', color: '#ff7eb6' } }, (g) => recordShop(g)),
    B(11, 21, 9, 6, 'office', 'ライブハウス 渋谷ドット', { wall: '#3a3242', roof: '#20232a', sign: { text: 'LIVE 渋谷ドット', bg: '#20232a', color: '#ffd23f' } }, (g) => liveHouse(g, '渋谷ドット')),
    B(27, 21, 8, 6, 'restaurant', 'カフェ', { wall: '#f6efe2', roof: '#6b4a2e', sign: { text: 'カフェ', bg: '#6b4a2e', color: '#fff3e0' } }, (g) => eatery(g, { greet: 'いらっしゃいませ。', items: [{ name: 'コーヒー', price: 500, stress: 4, text: '窓の外の人波をながめながら、ひと休み。', minutes: 20 }, { name: 'パンケーキ', price: 1200, heal: 20, fill: 20, stress: 3, text: 'ふわふわのパンケーキ。', minutes: 30 }] })),
    B(37, 21, 9, 6, 'office', '交番', { wall: '#e8ecf2', roof: '#2a4a8a', sign: { text: '交番', bg: '#2a4a8a', color: '#ffffff' } }, ['交番だ。おまわりさんが道案内をしている。', '「ハチ公前で待ち合わせ？　人が多いから、目じるしを決めておくといいよ」']),
    postSign(20, 26, 'センター街', ['「センター街」の入口。', '細い通りに、お店がぎっしり。']),
    postSign(25, 26, '道玄坂', ['「道玄坂」。坂の上にも、ライブハウスや劇場がある。']),
    npc('sb_gal', 6, 9, 'down', { ...LOOKS.fan, top: '#ff7eb6', hairColor: 'blonde' }, '若者', (g) => [yearOf(g) < 1993 ? 'センター街で遊ぶのが、いちばんの楽しみ！' : yearOf(g) < 2010 ? 'プリクラ撮って、センター街ぶらぶらするの〜！' : '交差点の動画を撮りに来たの！', 'ハチ公前で待ち合わせ。でも人多すぎ〜！'], { wander: 2 }),
    npc('sb_tourist', 26, 10, 'left', LOOKS.tourist, '観光客', (g) => [yearOf(g) >= 2010 ? 'Shibuya Crossing! 世界でいちばん有名な交差点って本当？' : '東京の若者の街、渋谷！', '信号が変わると、みんないっせいに歩き出すんだね。'], { wander: 2 }),
    npc('sb_police', 25, 15, 'down', { ...LOOKS.guard, hat: '#2a4a8a', top: '#2a4a8a' }, 'おまわりさん', (g) => [yearOf(g) >= 2013 ? '（マイクで）「みなさん、信号を守って、ゆっくり渡りましょう！」' : '交差点は、青になってから渡ってくださいね。', '大みそかやお祭りの夜は、ここが人でいっぱいになるんです。']),
    npc('sb_snap', 9, 16, 'up', { ...LOOKS.cameraman, top: '#20232a' }, 'ファッション誌のカメラマン', (g) => snap(g)),
    npc('sb_busker', 40, 28, 'down', { ...LOOKS.singer, top: '#3a7ac0' }, '弾き語りの人', ['（ギターをかき鳴らしている）', 'いつか、あの大きな画面に自分の歌が流れるのが夢なんだ。'], { wander: 1 }),
  ],
});
function screenWord(g) { const y = yearOf(g); return y < 2005 ? '新曲のミュージックビデオ' : y < 2015 ? '映画の予告とファッションの広告' : '動画配信の広告とアイドルの新曲'; }
async function fashion(g) {
  const y = yearOf(g);
  const trend = y < 1990 ? 'DCブランドの服' : y < 2000 ? 'ストリートの古着風ファッション' : y < 2010 ? 'ギャルとお兄系のファッション' : y < 2020 ? 'ファストファッションのセール' : '平成レトロ風のファッション';
  const i = await g.ask(`ファッションビルだ。いまの流行りは「${trend}」。`, ['服を見て回る（無料）', `一着買う（¥8,000）`, 'やめておく'], { cancel: 2 });
  if (i === 0) await sight(g, 'shibuya_fashion', ['フロアをぐるっと見て回った。', '流行りの服を見ているだけで、気分が上がる。'], 3, 40);
  else if (i === 1) {
    if (!g.spend(8000)) { await g.say('お金が足りない…。'); return; }
    g.sfx('coin');
    g.relax({ stress: 8, clean: 20 });
    await g.say([`${trend}を一着買った！`, '身なりがととのって、気分も晴れた。（身なり+20・ストレス-8）']);
  }
}
async function snap(g) {
  const k = 'eki_snap_day';
  if (g.flag(k) === g.state.day) { await g.say('「また今度、撮らせてね」'); return; }
  const life = g.state.life || {};
  if ((life.clean || 0) < 70) { await g.say(['「うーん、今日はほかの人を探してみるね」', '（身なりをととのえて来れば、声をかけてもらえるかも）']); return; }
  g.setFlag(k, g.state.day);
  g.addFame(2);
  await g.say(['「すみません、ストリートスナップ、一枚いいですか？」', 'パシャッ。ファッション誌のすみっこに載るらしい。（知名度+2）']);
}
async function recordShop(g) {
  const y = yearOf(g);
  const what = y < 1990 ? 'レコードとカセットテープ' : y < 2010 ? 'CDシングルとアルバム' : 'アナログレコードとCD';
  await shop(g, { greet: `レコード店だ。${what}がずらり。`, items: [{ name: '新譜を一枚', price: 2500, stress: 6, text: '家で聴くのが楽しみだ。（ストレス-6）' }] });
}
async function liveHouse(g, name) {
  const i = await g.ask(`ライブハウス「${name}」。今夜はオープンマイクの日だ。`, ['ステージで歌う（体力-15）', 'ライブを観る（¥2,000）', 'やめておく'], { cancel: 2 });
  if (i === 0) await job(g, { id: 'eki_live_' + name, title: `${name}のオープンマイク`, stamina: 15, minigame: 'rhythm', opts: { difficulty: 2 }, pay: 2000, fame: 6, skill: 'uta', gain: 2, minutes: 120, confirm: false });
  else if (i === 1) {
    if (!g.spend(2000)) { await g.say('お金が足りない…。'); return; }
    g.sfx('coin'); g.relax({ stress: 10 });
    if (typeof g.advanceTime === 'function') g.advanceTime(120, 'ライブ');
    await g.say(['若いバンドの熱い演奏に、胸が熱くなった。（ストレス-10）']);
  }
}

// ======================================================================== 新宿
ekimae({
  id: 'ekimae_shinjuku', name: '新宿', station: 'shinjuku', region: 'tokyo', rail: 'ground', W: 48, H: 31, rotary: 18,
  skyline: [NISHI, TOCHO, TOCHO_BUILD],
  look: { wall: '#d4d6da', roof: '#4a5568' },
  intro: (g) => ['新宿駅前に出た。', yearOf(g) >= 1991 ? '西の空に、都庁のツインタワーがそびえている。' : '西口のほうで、大きなビルの工事をしている…。'],
  guide: { name: '新宿駅前', short: '新宿', hint: '電車で新宿駅へ（ドット環状線・中央線・多摩線）', lines: ['寄席「新宿ドット亭」：落語を聴く・高座にあがる', '思い出横丁の焼き鳥・家電量販店・都庁（1991年から）', '多摩線で下北沢・調布・府中へ'] },
  exitNote: ['新宿駅前の案内板だ。', '左：寄席・家電量販店　右：都庁・高層ビル街（西口）\n南：思い出横丁・バスのりば'],
  paint(K) {
    const { fill, set, put, vroad } = K;
    vroad(14, 21, 29);
    fill(1, 27, 46, 3, 'stone');
    for (const x of [3, 8, 13, 33, 38, 43]) put(x, 9, 'tree');
    for (const x of [2, 12, 31, 41]) put(x, 20, 'lamp');
    // 思い出横丁: a narrow alley with lanterns
    fill(20, 21, 8, 6, 'brick');
    for (const x of [20, 27]) for (let y = 21; y <= 25; y += 2) put(x, y, 'lantern');
  },
  entities: (K) => [
    B(1, 10, 10, 6, 'theater', '寄席 新宿ドット亭', { wall: '#f4e6cc', roof: '#3a2a20', sign: { text: '新宿ドット亭', bg: '#3a2a20', color: '#ffe48a' } }, (g) => yose(g, '新宿ドット亭', 'rakugo')),
    B(12, 10, 5, 6, 'shop', '家電量販店', { wall: '#ffffff', roof: '#d62f2f', stripes: ['#d62f2f', '#ffd23f'], sign: { text: '家電', bg: '#d62f2f', color: '#ffffff' } }, (g) => denki(g)),
    B(31, 9, 7, 7, 'office', '高層ビル', { wall: '#c8d0dc', roof: '#3a4a6a', sign: { text: '西口のビル', bg: '#ffffff' } }, (g) => g.say([yearOf(g) >= 1991 ? '高層ビルだ。この先に都庁がある。展望室は無料で入れるらしい。' : '高層ビルだ。西口は、日本でいちばん高いビルが集まる街。'])),
    B(39, 9, 8, 7, 'office', '都庁', { wall: '#b8bece', roof: '#5a6478', sign: { text: '都庁 展望室', bg: '#2a3a6a', color: '#ffffff' } }, (g) => tocho(g), { cond: (g) => yearOf(g) >= 1991 }),
    B(39, 11, 8, 5, 'office', '建設中の庁舎', { wall: '#c8ccd4', roof: '#e8a020', sign: { text: '新庁舎 建設中', bg: '#e8a020', color: '#20232a' } }, ['工事の囲いだ。「東京都 新庁舎 建設工事」と書いてある。', '完成は、平成3年の予定らしい。'], { cond: (g) => yearOf(g) < 1991 }),
    B(1, 21, 9, 6, 'small', '焼き鳥屋', { wall: '#f4e6cc', roof: '#3a2a20', sign: { text: '焼き鳥', bg: '#d62f2f', color: '#ffffff' } }, (g) => yakitori(g)),
    B(21, 21, 6, 5, 'small', '思い出横丁の店', { wall: '#e8d8b8', roof: '#5a3a20', sign: { text: '横丁', bg: '#20232a', color: '#ffd23f' } }, (g) => yakitori(g)),
    B(30, 21, 8, 6, 'office', '高速バスのりば', { wall: '#e8ecf2', roof: '#2f6fd0', sign: { text: '高速バス', bg: '#2f6fd0', color: '#ffffff' } }, (g) => g.say([yearOf(g) >= 2016 ? '新宿の高速バスターミナル。全国行きの高速バスが、ここに集まっている。' : '西口の高速バスのりばだ。', '大阪行きの夜行バスもある。新幹線より安いけれど、一晩がかり。'])),
    B(39, 21, 8, 6, 'restaurant', 'ファミレス', { wall: '#fff6e8', roof: '#c0392b' }, (g) => eatery(g, { greet: 'いらっしゃいませ。何名さまですか？', items: [{ name: 'ハンバーグ定食', price: 1100, heal: 35, fill: 40, stress: 2, text: '鉄板の上で、じゅうじゅう音がする。', minutes: 30 }, { name: 'ドリンクバー', price: 400, stress: 3, text: 'ネタ帳を広げて、だらだら作戦会議。', minutes: 60 }] })),
    postSign(17, 26, '思い出横丁', ['「思い出横丁」。', '小さな飲み屋が肩を寄せあう、昔ながらの横丁。']),
    postSign(29, 15, '歌舞伎町→', ['「歌舞伎町」はこの先、東口の北。', '夜の繁華街だ。']),
    npc('sj_lost', 20, 10, 'down', { ...LOOKS.fan, top: '#5fd7ff' }, '迷子の人', ['東口？　西口？　南口？', 'この駅、出口が多すぎて、どこに出たかわからない…！'], { wander: 2 }),
    npc('sj_worker', 34, 16, 'left', LOOKS.salaryman, '会社員', (g) => [yearOf(g) >= 1991 ? '都庁の展望室、無料なんだよ。晴れた日は富士山も見える。' : '西口に、新しい都庁ができるらしいよ。', 'ここは毎日、ものすごい人が乗り降りする駅さ。'], { wander: 2 }),
    npc('sj_rakugo', 11, 16, 'up', { ...LOOKS.oldman, top: '#3a3f6a' }, '寄席の常連', ['寄席は、昼から夜まで出入り自由。', '若手の前座さんが、いちばん先に高座にあがるんだ。'], { wander: 1 }),
    npc('sj_drama', 40, 28, 'down', { ...LOOKS.actress, top: '#8a5ac8' }, '劇団員', ['小劇場をはしごしてるの。', '下北沢にも行ってみて。多摩線ですぐよ。']),
  ],
});
async function denki(g) {
  const y = yearOf(g);
  const what = y < 1992 ? 'ワープロ、ラジカセ、ビデオデッキ' : y < 2000 ? 'パソコン、PHS、ゲーム機' : y < 2012 ? '薄型テレビ、デジカメ、ケータイ' : 'スマホ、ワイヤレスイヤホン、AI家電';
  await sight(g, 'denki', ['家電量販店だ。', `店頭には、${what}がずらり。`, '試供品のマッサージチェアで、ちょっとひと休み。'], 3, 25);
}
async function tocho(g) { await sight(g, 'tocho', ['都庁の展望室にのぼった。（無料）', '東京の街が、どこまでも広がっている。晴れた日は富士山も見えるらしい。'], 5, 45); }
async function yakitori(g) {
  let age = 25;
  try { age = ageOf(g.state); } catch (e) { /* default */ }
  const adult = !(Number.isFinite(age) && age < 20);
  const items = [{ name: '焼き鳥セット', price: 900, heal: 25, fill: 25, stress: 3, text: '炭火の香り。肩を寄せあって食べる焼き鳥は格別だ。', minutes: 40 }];
  if (adult) items.push({ name: 'ビールと焼き鳥', price: 1500, heal: 20, fill: 20, stress: 7, text: 'となりの席のおじさんと、なぜか話がはずんだ。', minutes: 60 });
  await eatery(g, { greet: '「らっしゃい！」小さな店に、煙がもうもう。', items });
}
async function yose(g, name, mg) {
  const i = await g.ask(`寄席「${name}」。昼から夜まで、落語や漫才、色物がつづく。`, ['客席で聴く（¥3,000）', '高座にあがる（所属か★30）', 'やめておく'], { cancel: 2 });
  if (i === 0) {
    if (!g.spend(3000)) { await g.say('お金が足りない…。'); return; }
    g.sfx('coin'); g.relax({ stress: 10 }); g.addSkill('warai', 1, true);
    if (typeof g.advanceTime === 'function') g.advanceTime(150, '寄席');
    await g.say(['名人の高座に、客席が何度もどっと沸いた。', '間（ま）の取り方が、すごく勉強になった。（ストレス-10・お笑い+1）']);
  } else if (i === 1) {
    if (!ok30(g)) { await g.say(['席亭「うちの高座は、事務所に入っているか、もう少し名前が売れてからだね」', '（所属するか、知名度★30で出られる）']); return; }
    await job(g, { id: 'eki_yose_' + name, title: `${name}の高座`, stamina: 20, minigame: mg, opts: { difficulty: 2 }, pay: 6000, fame: 12, skill: 'warai', gain: 3, minutes: 180, confirm: false });
  }
}

// ======================================================================== 上野
ekimae({
  id: 'ekimae_ueno', name: '上野', station: 'ueno', region: 'tokyo', rail: 'ground', W: 48, H: 31, rotary: 30,
  skyline: [SKYTREE],
  look: { wall: '#e8dcc0', roof: '#6a4a3a' },
  intro: ['上野駅前に出た。', '公園の緑と、アメ横のにぎわいが同時に目に入る。'],
  guide: { name: '上野駅前', short: '上野', hint: '電車で上野駅へ（ドット環状線・ドットメトロ さくら線）', lines: ['上野公園：動物園・美術館・不忍池のボート', 'アメ横：海鮮丼・たたき売り', '浅草へはメトロでひと駅'] },
  exitNote: ['上野駅前の案内板だ。', '左（公園口）：上野公園・動物園・美術館・不忍池\n右：アメ横　南：大通り'],
  paint(K) {
    const { fill, set, put } = K;
    // 上野公園 (upper left): grass, sakura, the pond with a boat pier
    fill(1, 5, 16, 11, 'grass');
    for (let y = 5; y <= 15; y++) set(9, y, 'path');
    for (let x = 1; x <= 16; x++) set(x, 9, 'path');
    for (const [x, y] of [[2, 6], [6, 6], [12, 6], [15, 7], [2, 11], [15, 12]]) put(x, y, 'sakura');
    fill(1, 21, 14, 6, 'canal');
    for (let x = 1; x <= 14; x++) put(x, 20, 'railing');
    set(7, 20, 'sidewalk'); set(7, 21, 'bridge_v');
    put(4, 10, 'bench'); put(13, 10, 'bench');
    // アメ横 (lower right): a busy lane with stalls
    fill(30, 21, 17, 6, 'brick');
    fill(1, 27, 46, 3, 'stone');
    for (const x of [31, 36, 41, 46]) put(x, 21, 'nobori');
  },
  entities: (K) => [
    B(10, 10, 7, 5, 'office', '美術館', { wall: '#e8e0d0', roof: '#5a4a3a', sign: { text: '美術館', bg: '#5a4a3a', color: '#ffffff' } }, (g) => museum(g)),
    B(1, 12, 7, 4, 'small', '動物園の正門', { wall: '#f4ecd8', roof: '#2f8a4a', sign: { text: '動物園', bg: '#2f8a4a', color: '#ffffff' } }, (g) => zoo(g)),
    { type: 'npc', id: 'ue_boat', x: 7, y: 21, dir: 'up', look: { ...LOOKS.staff, top: '#3a7ac0' }, name: 'ボート乗り場の人', talk: (g) => boat(g) },
    B(31, 21, 7, 5, 'small', '海鮮丼の店', { wall: '#f4e6cc', roof: '#2a3a7a', sign: { text: '海鮮丼', bg: '#2a3a7a', color: '#ffffff' } }, (g) => eatery(g, { greet: '「安いよ、安いよ〜！　海鮮丼、いかが！」', items: [{ name: '海鮮丼', price: 1000, heal: 35, fill: 35, stress: 3, text: 'まぐろ、いくら、ほたて。ぜいたくな一杯！', minutes: 25 }] })),
    B(39, 21, 8, 5, 'shop', 'アメ横のお菓子屋', { wall: '#fff6e0', roof: '#d62f2f', stripes: ['#d62f2f', '#ffd23f'], sign: { text: 'お菓子', bg: '#d62f2f', color: '#ffffff' } }, (g) => shop(g, { greet: '「はい、もう一つおまけ！　もう一つ！　ぜんぶで千円！」', items: [{ name: 'チョコのたたき売り', price: 1000, item: 'ameyoko_choco', stress: 3, text: '袋にチョコがどっさり。おまけがすごい！' }] })),
    B(31, 5, 9, 5, 'office', '上野の百貨店', { wall: '#efe8dc', roof: '#6a4a3a', sign: { text: '百貨店', bg: '#6a4a3a', color: '#ffffff' } }, ['老舗の百貨店だ。', '屋上には、小さな遊園地があったこともあるらしい。']),
    postSign(29, 26, 'アメ横', ['「アメ横」の入口。', '乾物、果物、鮮魚、お菓子。年末は買い出しの人であふれる。']),
    npc('ue_hanami', 5, 8, 'right', { ...LOOKS.salaryman, top: '#ff9ab8' }, '花見の場所とり', (g) => [NET_month(g) >= 3 && NET_month(g) <= 4 ? '桜の季節は、朝から場所とり！　新人の仕事なんだ…。' : '春になると、ここは花見の人でいっぱいになるんだよ。']),
    npc('ue_north', 25, 11, 'down', { ...LOOKS.tourist, top: '#8a7a5a' }, '北から来た人', (g) => [yearOf(g) < 1991 ? '夜行列車で東北から出てきたんだ。上野は、北の玄関口さ。' : '新幹線で東北から。上野で乗りかえるんだ。', '東京に来たら、まずアメ横で買い物さ。']),
    npc('ue_shopper', 38, 24, 'up', { ...LOOKS.oldwoman, top: '#5a8a5a' }, '買い出しのおばちゃん', ['年末のアメ横は、歩けないくらいの人なのよ。', '値切るのも楽しみのうちよ！'], { wander: 2 }),
  ],
});
const NET_month = (g) => { try { return (g.gameDate && g.gameDate().month) || 4; } catch (e) { return 4; } };
async function museum(g) {
  const i = await g.ask('美術館だ。いまは「近代絵画展」を開催中。（¥1,800）', ['観る', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(1800)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin'); g.relax({ stress: 8 }); g.addSkill('engi', 1, true);
  if (typeof g.advanceTime === 'function') g.advanceTime(90, '美術館');
  await g.say(['静かな展示室で、名画とじっくり向きあった。', '表情の描き方が、演技のヒントになりそうだ。（ストレス-8・演技+1）']);
}
function pandaWord(g) {
  const ym = ymOf(g);
  if (ym >= 202602) return 'パンダ舎は、ひっそりしている。2026年1月に双子のパンダが中国へ帰って、日本のパンダはいなくなった。';
  if (ym >= 201102) return 'パンダ舎には長い行列。ささを食べる姿が、とにかくかわいい！';
  if (ym >= 200805) return 'パンダ舎は、いまは空っぽ。またパンダが来る日を、みんな待っている。';
  return 'パンダ舎には長い行列。のんびりささを食べている。';
}
async function zoo(g) {
  const i = await g.ask('動物園の正門だ。（入園料 ¥600）', ['入る', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(600)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin'); g.relax({ stress: 8 });
  if (typeof g.advanceTime === 'function') g.advanceTime(120, '動物園');
  await g.say(['ゾウ、キリン、ゴリラ…。動物たちを見て回った。', pandaWord(g), '（ストレス-8）']);
}
async function boat(g) {
  const i = await g.ask('「ボート、乗っていきます？　30分 ¥700」', ['乗る', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(700)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin'); g.relax({ stress: 6 }); g.useStamina(Math.min(3, g.state.stamina));
  if (typeof g.advanceTime === 'function') g.advanceTime(30, 'ボート');
  await g.say(['池の上をゆっくりこいだ。ハスの葉が風にゆれる。', '（ストレス-6）']);
}

// ======================================================================== 浅草
ekimae({
  id: 'ekimae_asakusa', name: '浅草', station: 'asakusa', region: 'tokyo', rail: 'under', W: 48, H: 36, rotary: null, sx: 6,
  skyline: [SKYTREE],
  intro: ['浅草駅の出口を出た。', '大きなちょうちんの門が見える。あれが雷門だ！'],
  guide: { name: '浅草', short: '浅草', hint: 'ドットメトロ さくら線の終点・浅草駅', lines: ['演芸ホール「浅草ドット演芸ホール」：観る・出演する（所属か★30）', '雷門・仲見世（人形焼）・お寺（お参り・おみくじ）', '人力車・スカイツリーの見える街（2012年から）'] },
  exitNote: ['浅草の案内板だ。', '南：雷門 → 仲見世 → お寺\n右：演芸ホール・人力車のりば'],
  paint(K) {
    const { fill, set, put } = K;
    // the gate on the main road's south side, 仲見世 going south to the temple
    fill(19, 21, 10, 8, 'ekimae_paving');
    fill(1, 21, 18, 8, 'grass'); fill(29, 21, 18, 8, 'grass');
    fill(1, 29, 46, 6, 'stone');
    for (const [x, y] of [[2, 22], [6, 24], [10, 22], [14, 26], [32, 22], [38, 24], [44, 22], [42, 27], [3, 30], [44, 30]]) put(x, y, (x + y) % 3 ? 'tree' : 'sakura');
    for (const x of [17, 31]) put(x, 20, 'lamp');
  },
  entities: (K) => [
    lanternGate(22, 20, '雷門', { text: undefined }),
    ...lanternPillars(22, 20),
    B(19, 22, 4, 3, 'small', '人形焼の店', { wall: '#f4e6cc', roof: '#3a2a20', sign: { text: '人形焼', bg: '#a8202a', color: '#ffffff' } }, (g) => shop(g, { greet: '「焼きたての人形焼、いかがですか〜」', items: [{ name: '人形焼', price: 600, item: 'ningyoyaki', text: '人形焼を買った。おみやげにもなる。' }] })),
    B(26, 22, 3, 3, 'small', 'せんべい屋', { wall: '#f4e6cc', roof: '#3a2a20', sign: { text: 'せんべい', bg: '#3a2a20', color: '#ffe48a' } }, (g) => eatery(g, { greet: '「手焼きのせんべい、一枚からどうぞ」', items: [{ name: '焼きたてせんべい', price: 200, heal: 6, fill: 6, stress: 2, text: 'パリッ！しょうゆの香ばしさ。', minutes: 5 }] })),
    B(19, 26, 4, 3, 'small', 'おみやげ屋', { wall: '#fff6e0', roof: '#a8202a', sign: { text: 'みやげ', bg: '#ffd23f', color: '#a8202a' } }, ['ちょうちんのキーホルダー、扇子、手ぬぐい。', '外国からのお客さんに大人気だ。']),
    B(26, 26, 3, 3, 'small', '甘味処', { wall: '#f4e6cc', roof: '#5a3a20', sign: { text: '甘味', bg: '#5a3a20', color: '#ffffff' } }, (g) => eatery(g, { greet: '「おしるこ、あんみつ、ございます」', items: [{ name: 'あんみつ', price: 700, heal: 10, fill: 10, stress: 5, text: '寒天と黒みつ。ほっとする甘さ。', minutes: 20 }] })),
    { type: 'building', x: 19, y: 30, w: 10, h: 5, kind: 'theater', name: 'お寺の本堂', wall: '#c8303a', roof: '#3a3f48', sign: { text: '本堂', bg: '#3a2a20', color: '#ffe48a' }, talk: (g) => temple(g) },
    B(33, 9, 12, 7, 'theater', '浅草ドット演芸ホール', { wall: '#f6e7c8', roof: '#a8202a', sign: { text: '浅草ドット演芸ホール', bg: '#a8202a', color: '#ffe48a' } }, (g) => engei(g)),
    B(17, 3, 8, 5, 'restaurant', '洋食屋', { wall: '#fff6e8', roof: '#8a3a2a', sign: { text: '洋食', bg: '#8a3a2a', color: '#ffffff' } }, (g) => eatery(g, { greet: '「いらっしゃいませ。創業は昭和のはじめです」', items: [{ name: 'ハヤシライス', price: 1400, heal: 35, fill: 35, stress: 3, text: 'じっくり煮こんだ、昔ながらの味。', minutes: 30 }] })),
    B(26, 3, 6, 5, 'small', 'どじょう料理', { wall: '#f4e6cc', roof: '#3a2a20', sign: { text: 'どぜう', bg: '#3a2a20', color: '#ffffff' } }, (g) => eatery(g, { greet: '「いらっしゃい。どぜう鍋、ネギたっぷりでどうぞ」', items: [{ name: 'どぜう鍋', price: 1800, heal: 30, fill: 30, stress: 4, text: '浅く煮たどじょうに、ネギを山盛り。江戸の味だ。', minutes: 40 }] })),
    B(34, 3, 12, 5, 'office', '観光センター', { wall: '#f0ece4', roof: '#3a3f48', sign: { text: '観光センター', bg: '#3a3f48', color: '#ffffff' } }, ['観光センターだ。浅草の地図やパンフレットが並んでいる。', '屋上の展望テラスから、雷門と仲見世が見下ろせるらしい。']),
    B(1, 10, 8, 6, 'small', '天ぷら屋', { wall: '#f4e6cc', roof: '#3a2a20', sign: { text: '天ぷら', bg: '#3a2a20', color: '#ffffff' } }, (g) => eatery(g, { greet: '「いらっしゃい！　天丼、揚げたてだよ」', items: [{ name: '天丼', price: 1500, heal: 40, fill: 40, stress: 3, text: 'ごま油の香り。えびがはみ出す天丼！', minutes: 30 }] })),
    B(13, 10, 5, 6, 'small', '遊園地の入口', { wall: '#fff0f4', roof: '#ff7eb6', sign: { text: '遊園地', bg: '#ff7eb6', color: '#ffffff' } }, (g) => sight(g, 'asakusa_yuenchi', ['古くからある小さな遊園地だ。', 'ローラーコースターが、住宅のすぐそばを走っている。'], 4, 40)),
    npc('as_rickshaw', 31, 16, 'left', { ...LOOKS.staff, top: '#20232a', hat: '#20232a' }, '人力車の車夫', (g) => rickshaw(g)),
    npc('as_tourist', 28, 16, 'down', { ...LOOKS.tourist, top: '#ff9a3c' }, '観光客', (g) => [yearOf(g) >= 2012 ? 'Kaminarimon! ちょうちんの向こうに、スカイツリーも見えるよ！' : '雷門の前で、記念写真！', '仲見世を通って、お寺までお参りするんだ。'], { wander: 1 }),
    npc('as_geinin', 44, 16, 'up', { ...LOOKS.comedian, top: '#3a3f48' }, 'ベテラン芸人', ['この演芸ホールで、何十年も漫才をやってるよ。', '浅草はね、芸人を育てる街なんだ。お客さんがきびしいからね。'], { wander: 1 }),
    npc('as_oba', 10, 27, 'up', { ...LOOKS.oldwoman, top: '#5a5a8a' }, '下町のおばあちゃん', ['お寺の境内で、毎朝ハトにえさをやるのが日課なのよ。'], { wander: 2 }),
  ],
});
async function temple(g) {
  const i = await g.ask('お寺の本堂だ。線香のけむりがただよっている。', ['お参りする（おさい銭 ¥100）', 'おみくじを引く（¥100）', 'やめておく'], { cancel: 2 });
  if (i < 0 || i > 1) return;
  if (!g.spend(100)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin');
  if (i === 0) { await sight(g, 'asakusa_omairi', ['手を合わせて、お参りした。', '（いいネタが書けますように…）'], 4, 10); return; }
  const kuji = [['大吉', 'なにをやってもうまくいく。思いきって挑戦せよ。'], ['吉', '地道な努力が、やがて実をむすぶ。'], ['中吉', '人との出会いが、運を開く。'], ['小吉', 'あせらず、目の前のことを一つずつ。'], ['末吉', 'いまは準備のとき。いずれ花ひらく。'], ['凶', '油断大敵。けれど、ここからは上がるだけ。']];
  const k = kuji[(g.state.day * 7 + (g.state.money % 13)) % kuji.length];
  await g.say([`おみくじは…「${k[0]}」！`, k[1], k[0] === '凶' ? '（おみくじを木の枝に結んでおいた）' : '']);
}
async function engei(g) {
  const i = await g.ask('浅草ドット演芸ホール。昼の部から夜の部まで、漫才・落語・コント・マジック。', ['客席で観る（¥3,000）', '出演する（所属か★30）', 'やめておく'], { cancel: 2 });
  if (i === 0) {
    if (!g.spend(3000)) { await g.say('お金が足りない…。'); return; }
    g.sfx('coin'); g.relax({ stress: 12 }); g.addSkill('warai', 1, true);
    if (typeof g.advanceTime === 'function') g.advanceTime(180, '演芸ホール');
    await g.say(['ベテランの漫才に、客席が割れんばかりの大爆笑。', '浅草の客は、笑うまでがきびしい。だからこそ勉強になる。（ストレス-12・お笑い+1）']);
  } else if (i === 1) {
    if (!ok30(g)) { await g.say(['支配人「うちの舞台は、事務所に入っているか、もう少し名前が売れてからだね」', '（所属するか、知名度★30で出られる）']); return; }
    await job(g, { id: 'eki_asakusa_engei', title: '浅草ドット演芸ホールの舞台', stamina: 20, minigame: 'tsukkomi', opts: { difficulty: 2 }, pay: 7000, fame: 14, skill: 'warai', gain: 3, minutes: 180, confirm: false });
  }
}
async function rickshaw(g) {
  const i = await g.ask('「人力車、いかがっすか！　浅草ひとまわり、¥4,000！」', ['乗る', 'またこんど'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(4000)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin'); g.relax({ stress: 10 });
  if (typeof g.advanceTime === 'function') g.advanceTime(30, '人力車');
  await g.say(['車夫さんの軽快な案内で、下町をひとまわり。', '「ここの路地はね、昔、芸人さんがたくさん住んでたんですよ」（ストレス-10）']);
}

// ======================================================================== 秋葉原
ekimae({
  id: 'ekimae_akihabara', name: '秋葉原', station: 'akihabara', region: 'tokyo', rail: 'elevated', W: 48, H: 31, rotary: null,
  look: { wall: '#eef0f4', roof: '#3a5a8a' },
  intro: (g) => ['秋葉原駅の電気街口に出た。', yearOf(g) < 1995 ? '家電の看板がずらりと並ぶ。' : yearOf(g) < 2004 ? 'パソコンの看板がずらりと並ぶ。' : 'アニメとゲームの看板が、ビルの壁をうめつくしている！'],
  guide: { name: '秋葉原駅前', short: '秋葉原', hint: '電車で秋葉原駅へ（ドット環状線）', lines: ['電気街：時代ごとの家電・パソコン・アニメ', 'カフェ・ゲームセンター（時代による）', '日曜の歩行者天国'] },
  exitNote: ['電気街口の案内板だ。', '大通り（中央通り）ぞいに、電気の店がずらり。'],
  paint(K) {
    const { fill, put } = K;
    fill(1, 27, 46, 3, 'brick');
    for (const x of [2, 16, 30, 44]) put(x, 20, 'lamp');
    put(15, 9, 'vending'); put(32, 9, 'vending'); put(33, 9, 'trash');
  },
  entities: (K) => [
    B(1, 10, 8, 6, 'shop', '電気店', { wall: '#ffffff', roof: '#2f6fd0', stripes: ['#2f6fd0', '#ffd23f'], sign: { text: '電気の店', bg: '#2f6fd0', color: '#ffffff' } }, (g) => akibaShop(g, 0)),
    B(10, 10, 7, 6, 'shop', '電気店', { wall: '#ffffff', roof: '#d62f2f', stripes: ['#d62f2f', '#ffffff'], sign: { text: '家電', bg: '#d62f2f', color: '#ffffff' } }, (g) => akibaShop(g, 1), { cond: (g) => yearOf(g) < 1995 }),
    B(10, 10, 7, 6, 'shop', 'パソコンの店', { wall: '#ffffff', roof: '#3a3f6a', stripes: ['#3a3f6a', '#5fd7ff'], sign: { text: 'パソコン', bg: '#3a3f6a', color: '#5fd7ff' } }, (g) => akibaShop(g, 1), { cond: (g) => yearOf(g) >= 1995 }),
    B(31, 10, 8, 6, 'shop', 'ゲームセンター', { wall: '#2a2d36', roof: '#8a5ac8', stripes: ['#ff7eb6', '#5fd7ff'], sign: { text: 'ゲーム', bg: '#20232a', color: '#5fd7ff' } }, (g) => sight(g, 'akiba_game', ['ゲームセンターだ。', yearOf(g) < 1995 ? '対戦格闘ゲームの前に、人だかりができている。' : yearOf(g) < 2010 ? '音楽ゲームの筐体で、すごい腕前の人がプレイしている。' : 'クレーンゲームの景品は、アニメのフィギュアばかり。', '（一回だけ遊んだ）'], 4, 20)),
    B(40, 10, 7, 6, 'cafe', 'カフェ', { wall: '#fff0f4', roof: '#ff7eb6', sign: { text: 'カフェ', bg: '#ff7eb6', color: '#ffffff' } }, (g) => akibaCafe(g)),
    B(2, 21, 8, 6, 'shop', 'アニメの店', { wall: '#fff6e0', roof: '#ff8a3d', stripes: ['#ff8a3d', '#ffd23f'], sign: { text: 'アニメ', bg: '#ff8a3d', color: '#ffffff' } }, ['アニメのグッズ、マンガ、同人誌。', '新作の告知ポスターの前で、ファンが熱く語りあっている。'], { cond: (g) => yearOf(g) >= 2000 }),
    B(2, 21, 8, 6, 'shop', 'オーディオの店', { wall: '#f4f4f4', roof: '#5a5f6b', stripes: ['#5a5f6b', '#c8ccd4'], sign: { text: 'オーディオ', bg: '#5a5f6b', color: '#ffffff' } }, ['大きなスピーカーとステレオがずらり。', 'お店の人が、レコードで音の聞きくらべをさせてくれる。'], { cond: (g) => yearOf(g) < 2000 }),
    B(12, 21, 9, 6, 'office', '電気街のビル', { wall: '#e8ecf2', roof: '#3a4a6a', sign: { text: '電気街', bg: '#ffd23f', color: '#20232a' } }, (g) => g.say([yearOf(g) >= 2016 ? '免税の看板が出ている。外国からの買い物客でいっぱいだ。' : '細い通路に、小さな部品屋さんがぎっしり。', yearOf(g) >= 2010 ? '真空管から最新のスマホの部品まで、なんでもそろう。' : '真空管から最新のパソコンの部品まで、なんでもそろう。'])),
    B(26, 21, 9, 6, 'shop', 'カードショップ', { wall: '#ffffff', roof: '#2f9a4a', stripes: ['#2f9a4a', '#ffd23f'], sign: { text: 'カード', bg: '#2f9a4a', color: '#ffffff' } }, ['トレーディングカードの店だ。', 'ガラスケースの中に、目玉の飛び出るような値段のカードが…。'], { cond: (g) => yearOf(g) >= 1999 }),
    B(37, 21, 9, 6, 'restaurant', 'ラーメン屋', { wall: '#f4e6cc', roof: '#3a2a20', sign: { text: 'ラーメン', bg: '#d62f2f', color: '#ffffff' } }, (g) => eatery(g, { greet: '「いらっしゃい！　食券を買ってね」', items: [{ name: 'こってりラーメン', price: 900, heal: 35, fill: 40, stress: 2, text: '背脂たっぷり。スープまで飲みほした。', minutes: 20 }] })),
    npc('ak_otaku', 22, 10, 'down', { ...LOOKS.salaryman, top: '#5a7a9a', glasses: true }, '電気街の常連', (g) => [yearOf(g) < 1995 ? 'このへんは、家電なら何でもそろう。値切るのがコツだよ。' : yearOf(g) < 2005 ? '新しいパソコンのパーツを探しに来たんだ。自作するのさ。' : '昔は電気の街、いまはアニメとゲームの街だね。', '日曜は大通りが歩行者天国になるんだ。'], { wander: 2 }),
    npc('ak_tourist', 29, 16, 'left', { ...LOOKS.tourist, top: '#ffd23f' }, '旅行者', ['Akihabara! カメラと、ゲームと、アニメ！', 'ここは、ぼくの国でも有名なんだよ。'], { wander: 2 }),
    npc('ak_family', 18, 28, 'up', { ...LOOKS.mom, top: '#ff9ab8' }, '家族連れ', (g) => [yearOf(g) < 1995 ? '新しい冷蔵庫を買いに来たの。ここなら安いから。' : 'こどもが、ゲームを見たいってきかなくて。'], { wander: 1 }),
  ],
});
async function akibaShop(g, k) {
  const y = yearOf(g);
  const items = y < 1992 ? 'ラジカセ、ビデオデッキ、ファミコン' : y < 2000 ? 'パソコン、モデム、PHS' : y < 2010 ? '薄型テレビ、デジカメ、ケータイ' : 'スマホ、ゲーム機、パソコンのパーツ';
  await sight(g, 'akiba_' + k, ['電気街の店だ。', `店頭に、${items}が山積み。`, '店員さんの呼び込みの声が、通りにひびく。'], 3, 25);
}
async function akibaCafe(g) {
  const y = yearOf(g);
  const maid = y >= 2004;
  await eatery(g, { greet: maid ? '「おかえりなさいませ！」メイド服の店員さんが出迎えてくれた。' : '昔ながらの喫茶店だ。', items: [{ name: maid ? 'オムライス' : 'ナポリタン', price: 1200, heal: 30, fill: 30, stress: 5, text: maid ? 'ケチャップで、名前を書いてもらった。' : '鉄板の上で、ジュージューいっている。', minutes: 40 }] });
}

// ======================================================================== 下北沢
ekimae({
  id: 'ekimae_shimokita', name: '下北沢', station: 'shimokita', region: 'tokyo', rail: 'under', W: 48, H: 31, rotary: null, sx: 20,
  look: { wall: '#e8e0d0', roof: '#5a4a3a' },
  intro: ['下北沢駅前に出た。', '小劇場、ライブハウス、古着屋。せまい路地に、夢を追う人の匂いがする。'],
  guide: { name: '下北沢', short: '下北沢', hint: 'ドット多摩線で新宿から（下北沢駅）', lines: ['小劇場「ドット小劇場 下北」：観る・出演する（演技）', 'ライブハウス（歌）・古着屋・カレー', '2013年に線路が地下へ（踏切がなくなる）'] },
  exitNote: ['下北沢駅前の案内板だ。', '左：小劇場・カレー屋　右：ライブハウス・古着屋\n南：お笑いライブの小屋'],
  paint(K) {
    const { fill, set, put } = K;
    fill(1, 27, 46, 3, 'brick');
    for (const x of [3, 19, 33, 45]) put(x, 20, 'lamp');
    put(14, 9, 'bicycle'); put(15, 9, 'bicycle'); put(16, 9, 'bicycle');
  },
  entities: (K) => [
    // until 2013-03 the line ran on the ground here, with the 開かずの踏切 at the left; then the 線路あと
    { type: 'prop', x: 1, y: 2, w: 46, h: 2, solid: true, cond: (g) => ymOf(g) < 201303, text: ['線路だ。電車がひっきりなしに通る。', '（2013年に、この線路は地下へ移る）'],
      draw(ctx, sx, sy) { F(ctx, sx, sy, 736, 32, '#6e6a62'); for (const y of [7, 23]) F(ctx, sx, sy + y, 736, 2, '#c0c4cc'); for (let x = 0; x < 736; x += 10) F(ctx, sx + x, sy + 4, 4, 24, '#7a6a58'); F(ctx, sx + 64, sy, 48, 32, '#3a3d44'); for (const y of [7, 23]) F(ctx, sx + 64, sy + y, 48, 2, '#c8ccd4'); } },
    trainBand(1, 2, 46, ['#9a3fa8', '#3a7ac0'], { cond: (g) => ymOf(g) < 201303 }),
    crossingBarrier(4, 4, { cond: (g) => ymOf(g) < 201303, text: ['踏切だ。カンカンカン…。', 'さっきから、ずっと閉まったまま。「開かずの踏切」だ。'] }),
    crossingBarrier(8, 4, { cond: (g) => ymOf(g) < 201303, text: ['踏切だ。電車が何本も通りすぎていく…。'] }),
    { type: 'prop', x: 1, y: 2, w: 46, h: 2, solid: true, cond: (g) => ymOf(g) >= 201303 && ymOf(g) < 201905, text: ['工事の囲いだ。', '線路が地下に入って、地上の線路あとを工事している。'],
      draw(ctx, sx, sy) { F(ctx, sx, sy + 4, 736, 26, '#e8e4d8'); for (let x = 0; x < 736; x += 24) F(ctx, sx + x, sy + 4, 1, 26, '#c8c0b0'); F(ctx, sx, sy + 4, 736, 2, '#3a7ac0'); } },
    { type: 'prop', x: 1, y: 2, w: 46, h: 2, solid: false, z: -800, cond: (g) => ymOf(g) >= 201905,
      draw(ctx, sx, sy) { F(ctx, sx, sy, 736, 32, '#d8d2c4'); F(ctx, sx, sy + 12, 736, 8, '#c8b89a'); for (let x = 8; x < 736; x += 40) { F(ctx, sx + x, sy + 2, 10, 8, '#6aa85a'); F(ctx, sx + x + 20, sy + 22, 12, 8, '#7ab86a'); } } },
    { type: 'sign', x: 6, y: 4, cond: (g) => ymOf(g) >= 201905, text: ['線路のあとが、細長い遊歩道とお店の通りになっている。', '（「線路街」と呼ばれているらしい）'] },
    B(2, 3, 7, 5, 'small', '古本屋', { wall: '#efe2c8', roof: '#5a3a20', sign: { text: '古本', bg: '#5a3a20', color: '#ffffff' } }, (g) => shop(g, { greet: '古本屋だ。戯曲や演劇の本が、天井まで積まれている。', items: [{ name: '古い台本集', price: 500, item: 'daihon', text: '昔の名作の台本集。演技の参考になりそうだ。' }] })),
    B(10, 3, 8, 5, 'shop', '雑貨屋', { wall: '#fff6e0', roof: '#7ab86a', stripes: ['#7ab86a', '#ffffff'], sign: { text: '雑貨', bg: '#7ab86a', color: '#ffffff' } }, ['雑貨屋だ。古いおもちゃ、レコード、手作りのアクセサリー。', '見ているだけで時間がたつ。']),
    B(30, 3, 8, 5, 'cafe', 'カフェ', { wall: '#f6efe2', roof: '#6b4a2e', sign: { text: 'カフェ', bg: '#6b4a2e', color: '#fff3e0' } }, (g) => eatery(g, { greet: '小さなカフェ。壁一面に、ライブのフライヤー。', items: [{ name: 'カフェラテ', price: 550, stress: 4, text: 'ほっとひと息。', minutes: 30 }] })),
    B(39, 3, 7, 5, 'small', 'ラーメン屋', { wall: '#f4e6cc', roof: '#3a2a20', sign: { text: 'ラーメン', bg: '#d62f2f', color: '#ffffff' } }, (g) => eatery(g, { greet: '「らっしゃい！」', items: [{ name: '煮干しラーメン', price: 900, heal: 30, fill: 35, stress: 2, text: '煮干しの香りが、ガツンとくる。', minutes: 20 }] })),
    B(1, 10, 9, 6, 'theater', 'ドット小劇場 下北', { wall: '#3a3242', roof: '#20232a', sign: { text: 'ドット小劇場', bg: '#20232a', color: '#ffd23f' } }, (g) => smallTheater(g)),
    B(10, 10, 6, 6, 'small', 'カレー屋', { wall: '#f4e6cc', roof: '#8a5a20', sign: { text: 'カレー', bg: '#e8a020', color: '#3a2a20' } }, (g) => eatery(g, { greet: '「いらっしゃい。スパイス、効いてますよ」', items: [{ name: 'スープカレー', price: 1200, heal: 30, fill: 35, stress: 3, text: 'スパイスの香りが、体にしみわたる…！', minutes: 30 }] })),
    B(33, 10, 7, 6, 'shop', 'ライブハウス 下北ドット', { wall: '#2a2d36', roof: '#ff4f8b', stripes: ['#ff4f8b', '#20232a'], sign: { text: 'LIVE', bg: '#20232a', color: '#ff7eb6' } }, (g) => liveHouse(g, '下北ドット')),
    B(41, 10, 6, 6, 'boutique', '古着屋', { wall: '#f4ece0', roof: '#6a5a4a', sign: { text: '古着', bg: '#20232a', color: '#f4e6cc' } }, (g) => furugi(g)),
    B(2, 21, 9, 6, 'office', 'お笑いライブの小屋', { wall: '#f4f0e8', roof: '#3a7ac0', sign: { text: 'お笑いライブ', bg: '#3a7ac0', color: '#ffffff' } }, (g) => owaraiLive(g)),
    B(14, 21, 7, 6, 'cafe', '喫茶店', { wall: '#efe2c8', roof: '#5a3a20', sign: { text: '喫茶', bg: '#5a3a20', color: '#ffe48a' } }, (g) => eatery(g, { greet: '古い喫茶店。台本を書いている人が何人もいる。', items: [{ name: 'ブレンドコーヒー', price: 450, stress: 4, text: 'ネタを考えながら、ゆっくり一杯。', minutes: 45 }] })),
    B(28, 21, 8, 6, 'shop', 'レコード店', { wall: '#2a2d36', roof: '#5fd7ff', stripes: ['#5fd7ff', '#20232a'], sign: { text: 'レコード', bg: '#20232a', color: '#5fd7ff' } }, (g) => recordShop(g)),
    B(38, 21, 8, 6, 'small', '居酒屋', { wall: '#f4e6cc', roof: '#3a2a20', sign: { text: '居酒屋', bg: '#d62f2f', color: '#ffffff' } }, (g) => yakitori(g)),
    npc('sk_band', 18, 11, 'down', { ...LOOKS.singer, top: '#20232a', hairColor: 'brown' }, 'バンドマン', (g) => [ymOf(g) < 201303 ? '駅のよこの踏切、開かないんだよね。リハに遅れそう…。' : '踏切がなくなって、駅のまわりがすっかり変わったよ。', '今夜、そこのライブハウスでワンマンなんだ。'], { wander: 1 }),
    npc('sk_actor', 8, 16, 'up', { ...LOOKS.actor, top: '#8a5ac8' }, '劇団員', ['小劇場の舞台は、お客さんとの距離が近いの。', '息づかいまで伝わるから、ごまかしがきかないのよ。'], { wander: 1 }),
    npc('sk_geinin', 13, 28, 'up', { ...LOOKS.comedian2, top: '#ffd23f' }, '若手芸人', ['このへんは、お笑いライブの小屋も多いんだ。', 'エントリー料を払って、客前でネタをかけるのさ。'], { wander: 2 }),
    npc('sk_furugi', 40, 16, 'left', { ...LOOKS.fan, top: '#c8a060' }, '古着好き', ['古着屋めぐりなら、下北沢がいちばん！', '一点ものに出会えるのがいいんだ。'], { wander: 2 }),
  ],
});
async function smallTheater(g) {
  const i = await g.ask('ドット小劇場 下北。客席は百席ほど。今夜も若い劇団の公演だ。', ['観る（¥3,500）', '出演する（所属か★30・演技）', 'やめておく'], { cancel: 2 });
  if (i === 0) {
    if (!g.spend(3500)) { await g.say('お金が足りない…。'); return; }
    g.sfx('coin'); g.relax({ stress: 10 }); g.addSkill('engi', 1, true);
    if (typeof g.advanceTime === 'function') g.advanceTime(120, '観劇');
    await g.say(['役者の熱気が、最前列まで伝わってくる。', '（ストレス-10・演技+1）']);
  } else if (i === 1) {
    if (!ok30(g)) { await g.say(['主宰「客演は、事務所に入っているか、名前が売れてからね」', '（所属するか、知名度★30で出られる）']); return; }
    await job(g, { id: 'eki_shimokita_stage', title: 'ドット小劇場 下北の客演', stamina: 22, minigame: 'conte', opts: { difficulty: 2 }, pay: 6000, fame: 12, skill: 'engi', gain: 3, minutes: 240, confirm: false });
  }
}
async function furugi(g) {
  await shop(g, { greet: '古着屋だ。ヴィンテージのジャケットが、壁一面にかかっている。', items: [{ name: '古着のジャケット', price: 4000, stress: 6, text: '一点もののジャケット。身なりがぐっと良くなった気がする。' }] });
  try { if (g.state.life) g.relax({ clean: 10 }); } catch (e) { /* none */ }
}
async function owaraiLive(g) {
  const i = await g.ask('お笑いライブの小屋だ。今夜は若手のネタライブ。', ['エントリーしてネタをかける（¥1,000）', '観る（¥1,500）', 'やめておく'], { cancel: 2 });
  if (i === 0) {
    if (!g.spend(1000)) { await g.say('エントリー料が足りない…。'); return; }
    g.sfx('coin');
    await job(g, { id: 'eki_shimokita_owarai', title: '下北沢のお笑いライブ', stamina: 15, minigame: 'tsukkomi', opts: { difficulty: 2 }, pay: 1500, fame: 6, skill: 'warai', gain: 2, minutes: 150, confirm: false });
  } else if (i === 1) {
    if (!g.spend(1500)) { await g.say('お金が足りない…。'); return; }
    g.sfx('coin'); g.relax({ stress: 8 });
    if (typeof g.advanceTime === 'function') g.advanceTime(120, 'お笑いライブ');
    await g.say(['若手の勢いのあるネタに、何度も笑った。（ストレス-8）']);
  }
}

// ======================================================================== 調布（ドット自動車教習所）
ekimae({
  id: 'ekimae_chofu', name: '調布', station: 'chofu', region: 'tokyo', rail: 'under', W: 48, H: 31, rotary: 1, sx: 16,
  intro: (g) => ['調布駅前に出た。', ymOf(g) >= 201208 ? '駅が地下になって、駅前は広々としている。' : '駅前の踏切で、車が列をつくっている。', '大通りの向こうに、教習所のコースが見える。'],
  guide: { name: '調布駅前', short: '調布', hint: 'ドット多摩線で新宿から（調布駅）', lines: ['ドット自動車教習所（駅前・大通りの北）と教習コース', '映画館（映画のまち）・そば屋', 'ひと駅となりの府中に、免許センター'] },
  exitNote: ['調布駅前の案内板だ。', '右：ドット自動車教習所（コースは大通りの南）\n左：映画館・そば屋　多摩線で府中（免許センター）へ'],
  paint(K) {
    const { fill, set, put, vroad } = K;
    // the 教習コース (south of the main road, right half): fenced asphalt with a loop, islands, an S字 and a クランク
    fill(26, 21, 21, 9, 'grass');
    for (let x = 26; x <= 46; x++) { put(x, 21, 'fence'); put(x, 29, 'fence'); }
    for (let y = 21; y <= 29; y++) { put(26, y, 'fence'); put(46, y, 'fence'); }
    fill(27, 22, 19, 7, 'road');
    for (let x = 28; x <= 44; x++) { set(x, 22, 'road_edge_top'); set(x, 28, 'road_edge_bottom'); }
    fill(30, 24, 6, 3, 'grass'); fill(38, 24, 6, 3, 'grass');
    put(31, 25, 'cone'); put(34, 25, 'cone'); put(40, 25, 'cone'); put(42, 25, 'cone');
    for (let x = 36; x <= 37; x++) for (let y = 24; y <= 26; y++) set(x, y, 'road_line_v');
    // the left: a quiet street with the cinema
    fill(1, 27, 25, 3, 'stone');
    for (const x of [3, 13, 23]) put(x, 20, 'lamp');
    for (const x of [31, 37, 43]) put(x, 6, 'tree');
  },
  entities: (K) => [
    { type: 'prop', x: 1, y: 2, w: 46, h: 2, solid: true, cond: (g) => ymOf(g) < 201208, text: ['線路だ。', '（2012年に、この線路は地下へ移る）'], draw(ctx, sx, sy) { F(ctx, sx, sy, 736, 32, '#6e6a62'); for (const y of [7, 23]) F(ctx, sx, sy + y, 736, 2, '#c0c4cc'); for (let x = 0; x < 736; x += 10) F(ctx, sx + x, sy + 4, 4, 24, '#7a6a58'); } },
    trainBand(1, 2, 46, ['#9a3fa8'], { cond: (g) => ymOf(g) < 201208 }),
    { type: 'building', x: 30, y: 9, w: 12, h: 7, door: 6, place: 'kyoshujo', name: 'ドット自動車教習所', kind: 'office', wall: '#f1f4e8', roof: '#2f9a5a', canopy: '#2f9a5a', sign: { text: 'ドット自動車教習所', bg: '#2f9a5a', color: '#ffffff' } },
    groundMark(30, 22, 'S字'), groundMark(38, 22, 'クランク'), groundMark(28, 27, '坂道'), groundMark(42, 27, '縦列'),
    courseCar(27, 22, 45, 28, '#f2f2f6', 0), courseCar(27, 22, 45, 28, '#f2f2f6', 300),
    { type: 'sign', x: 25, y: 25, solid: true, text: ['教習コースだ。フェンスごしに、教習車が走っているのが見える。', '「S字」「クランク」「坂道発進」「縦列駐車」…。', '（コースは教習生専用。入所の相談は、教習所の受付で）'] },
    B(2, 5, 9, 5, 'theater', '映画館', { wall: '#f4ecd8', roof: '#3a3f6a', sign: { text: '映画館', bg: '#3a3f6a', color: '#ffe48a' } }, (g) => cinema(g)),
    B(18, 21, 7, 5, 'small', 'そば屋', { wall: '#f4e6cc', roof: '#3a2a20', sign: { text: 'そば', bg: '#3a2a20', color: '#ffffff' } }, (g) => eatery(g, { greet: '「いらっしゃい。名物の手打ちそば、ありますよ」', items: [{ name: 'ざるそば', price: 900, heal: 25, fill: 25, stress: 3, text: 'のどごしのいい、打ちたてのそば。', minutes: 20 }] })),
    B(2, 21, 9, 6, 'office', '撮影所の門', { wall: '#d8d2c4', roof: '#7d8391', sign: { text: '撮影所', bg: '#3a3f48', color: '#ffffff' } }, ['撮影所の門だ。調布は「映画のまち」。', '守衛さん「関係者以外は入れないよ。エキストラの募集は、東京の撮影所で」']),
    npc('ch_student', 28, 16, 'down', { ...LOOKS.fan, top: '#2f9a8a' }, '教習生', ['教習所、この駅からすぐなんです。', '卒業したら、ひと駅となりの府中の免許センターで学科試験。', 'そこで受かれば、やっと免許証！'], { wander: 1 }),
    npc('ch_kyokan', 44, 16, 'left', { hair: 'short', hairColor: 'black', skin: 'fair', top: '#e8e8ee', bottom: '#2a3a5a', hat: '#2a3a5a', jacket: true }, '休憩中の教官', ['コースの見学？　フェンスの外からなら、どうぞ。', 'S字とクランクは、ゆっくり、ゆっくり。速さより確実さですよ。']),
    npc('ch_movie', 14, 16, 'up', { ...LOOKS.oldman, top: '#5a4a3a' }, '映画好きのおじいさん', ['このあたりには、昔から撮影所があってね。', '若いころは、エキストラで時代劇に出たもんさ。'], { wander: 2 }),
    npc('ch_local', 14, 11, 'down', { ...LOOKS.mom, top: '#ff9a3c' }, '地元の人', (g) => [ymOf(g) >= 201208 ? '駅が地下になって、踏切の渋滞がなくなったのよ。' : '駅前の踏切、いつも渋滞してるのよね。地下にする工事をするんですって。']),
  ],
});
async function cinema(g) {
  const y = yearOf(g);
  const fee = y < 1995 ? 1500 : y < 2019 ? 1800 : 2000;
  const i = await g.ask(`映画館だ。（一般 ¥${fee.toLocaleString('ja-JP')}）`, ['観る', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(fee)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin'); g.relax({ stress: 10 }); g.addSkill('engi', 1, true);
  if (typeof g.advanceTime === 'function') g.advanceTime(130, '映画');
  await g.say(['大きなスクリーンで、映画を一本観た。', '主演の役者の、目の演技にしびれた。（ストレス-10・演技+1）']);
}

// ======================================================================== 府中（ドット運転免許センター）
ekimae({
  id: 'ekimae_fuchu', name: '府中', station: 'fuchu', region: 'tokyo', rail: 'elevated', W: 48, H: 31, rotary: null, sx: 16,
  look: { wall: '#e8ecf0', roof: '#5a6a80' },
  intro: ['府中駅前に出た。', 'けやき並木の先に、「ドット運転免許センター」の看板が見える。'],
  guide: { name: '府中駅前', short: '府中', hint: 'ドット多摩線の終点・府中駅', lines: ['ドット運転免許センター（運転免許試験場）：学科試験・交付・更新', '証明写真・代書屋・けやき並木・神社', 'ひと駅となりの調布に、教習所'] },
  exitNote: ['府中駅前の案内板だ。', '右：ドット運転免許センター（試験場前）\n左：けやき並木・神社'],
  paint(K) {
    const { fill, set, put } = K;
    // けやき並木 (left), the shrine grounds (lower left)
    for (let y = 5; y <= 15; y += 2) { put(2, y, 'tree'); put(13, y, 'tree'); }
    fill(1, 21, 16, 9, 'stone');
    for (const [x, y] of [[2, 22], [15, 22], [2, 28], [15, 28]]) put(x, y, 'tree');
    // the centre's car park (lower right)
    fill(28, 21, 19, 8, 'road');
    for (let x = 29; x <= 45; x += 3) for (let y = 22; y <= 27; y++) if (y !== 24 && y !== 25) set(x, y, 'road_line_v');
    fill(17, 27, 11, 3, 'stone'); fill(28, 29, 19, 1, 'stone');
    for (const x of [21, 33, 43]) put(x, 20, 'lamp');
  },
  entities: (K) => [
    { type: 'building', x: 30, y: 8, w: 14, h: 8, door: 7, place: 'menkyo', name: 'ドット運転免許センター', kind: 'office', wall: '#e4e8ee', roof: '#3a5a9a', canopy: '#3a5a9a', sign: { text: 'ドット運転免許センター', bg: '#2a4a8a', color: '#ffffff' } },
    postSign(28, 15, '試験場前', ['「試験場前」のバス停の標識。', '学科試験・免許の交付・更新の受付は、平日 午前9時〜午後4時（土日・祝日はお休み）。']),
    B(18, 21, 5, 5, 'small', '代書屋', { wall: '#f4ecd8', roof: '#5a5f6b', sign: { text: '代書', bg: '#5a5f6b', color: '#ffffff' } }, ['「代書・申請書類の書き方、お手伝いします」', 'おじさん「試験の前に、例題集もどうぞ。よく出るところに線を引いてあるよ」']),
    B(24, 21, 3, 5, 'small', '証明写真', { wall: '#e8ecf2', roof: '#2f6fd0', sign: { text: '写真', bg: '#2f6fd0', color: '#ffffff' } }, ['証明写真の機械だ。', '（免許証の写真は、センターの中で撮ってもらえる）']),
    { type: 'building', x: 4, y: 22, w: 8, h: 5, kind: 'theater', name: '神社', wall: '#e8d8b8', roof: '#3a4a3a', sign: { text: '神社', bg: '#3a2a20', color: '#ffe48a' }, talk: (g) => sight(g, 'fuchu_jinja', ['古い神社だ。大きなけやきの木に囲まれている。', '手を合わせた。（試験に受かりますように…）'], 4, 10) },
    npc('fu_jukensha', 22, 11, 'down', { ...LOOKS.fan, top: '#ff9ab8' }, '受験生', ['今日、本免の学科試験なんです。', '90%以上で合格…。ゆうべ、例題を三回解いてきました！'], { wander: 1 }),
    npc('fu_koshin', 34, 16, 'up', { ...LOOKS.salaryman, top: '#8a7a5a' }, '更新の人', ['免許の更新です。', '午前中に来ないと、待ち時間がすごいんですよ。'], { wander: 1 }),
    npc('fu_police', 26, 16, 'down', { ...LOOKS.guard, hat: '#2a4a8a', top: '#2a4a8a' }, '交通課のおまわりさん', ['ここは、運転免許の試験場ですよ。', '教習所を卒業したら、卒業証明書を持って、1年以内に来てくださいね。']),
    npc('fu_obaa', 8, 16, 'up', { ...LOOKS.oldwoman, top: '#5a7a5a' }, '散歩のおばあちゃん', ['このけやき並木は、ずっと昔からあるのよ。', '秋は落ち葉がきれいでねえ。'], { wander: 2 }),
  ],
});

// the てちょう (guide.js) hints for the two moved license places (their entries stay R9-A's; only the hint is updated here)
for (const [id, hint] of [['kyoshujo', 'ドット多摩線の調布駅前（新宿から電車で）'], ['menkyo', 'ドット多摩線の終点・府中駅前（試験場前）']]) {
  if (GUIDE[id]) GUIDE[id].hint = hint;
}
export const TOKYO_AREAS = ['ekimae_shibuya', 'ekimae_shinjuku', 'ekimae_ueno', 'ekimae_asakusa', 'ekimae_akihabara', 'ekimae_shimokita', 'ekimae_chofu', 'ekimae_fuchu'];
export { PLACES };
