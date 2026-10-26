// 喫茶店・カフェ・カラオケ [R12-S2]: a seat to work in, and a room to sing in.
//
//   shop_junkissa    純喫茶 ドット (東京 芸人通り, 7:00〜22:00): モーニング, ネタを書く席 (台本エディタ: g.writeNeta with a ネタの種 as the theme),
//                    作家志望のお客さんに台本を見てもらう (g.scoreNeta), 新聞 (ネタの種)
//   shop_cafe_t      カフェ (東京 劇場通り, 9:00〜21:00): 読み合わせ席: ネタ合わせ with the 相方 (g.owaraiPractice('awase')) or alone (g.netaRehearse), sweets
//   shop_junkissa_n  純喫茶 ドット (なんば 千日前, 7:00〜21:00): ミックスジュース・モーニング・スポーツ紙, 将棋のおじいさん, ネタを書く席
//   shop_karaoke_t   カラオケ (東京 芸人通り, 10:00〜26:00): hourly rooms (booking with the clock), 歌 (rhythm minigame), 発声練習, 台本の読み上げ, ネタ合わせ room
//   shop_karaoke_n   カラオケ (なんば, 10:00〜26:00): the same, 関西弁
// The seat is paid by the drink: a second hour at the same table needs another order (「コーヒー一杯で三時間」 only works so long).

import {
  registerShop, room, npc, sign, who, SS, dayN, bumpN, firstVisit, byEra, eraId, yearNow, monthNow, has, passTime, T, hm, nowTotal, openState,
  fmtMoney, pick, adult, LOOKS, orderMenu, addSeed, writeWithSeed, rumorTalk, diffText, clamp, MODS,
} from '../world/shopkit.js';

const say = (g, n, t) => g.say(t, who(n));
const THANK = ['ごゆっくりどうぞ。', 'またのお越しを。', 'ありがとうございます。'];

// ---------------------------------------------------------------- drinks and a seat
const drinkEntries = (g, kansai) => [
  { name: 'ブレンドコーヒー', price: 450, stress: 8, desc: 'マスターのこだわりブレンド。', text: '香ばしい香り…。ひと口ごとに、頭がすっきりしていく。' },
  { name: 'ミルクティー', price: 480, stress: 8, desc: 'ミルクたっぷりの、甘い紅茶。', text: 'やさしい甘さが、体にしみる。' },
  { name: kansai ? 'ミックスジュース' : 'クリームソーダ', price: 600, stress: 10, desc: kansai ? 'バナナにみかん、ミルク。大阪の喫茶店の定番。' : 'メロンソーダにアイスがぷかり。', text: kansai ? 'バナナとミルクの、やさしくてなつかしい味。' : 'しゅわしゅわ、ひんやり。…なんだか、子どもに戻った気分だ。' },
  { name: 'ホットケーキ', price: 750, heal: 14, fill: 28, stress: 9, desc: 'ふっくら厚焼きの、バターとシロップ。', text: 'ふかふかのホットケーキ。バターがとろりと溶けていく。' },
  { name: 'ナポリタン', price: 850, heal: 26, fill: 48, stress: 6, desc: '昔ながらの、鉄板ナポリタン。', text: 'ケチャップの甘い香り。…これぞ、喫茶店の味だ。' },
  { name: 'たまごサンド', price: 600, heal: 16, fill: 30, stress: 3, desc: '厚焼き卵のサンドイッチ。', text: 'ふかふかのパンに、厚焼き卵。…おかわりしたくなる。' },
];
const morning = (g) => {
  const t = nowTotal(g);
  return t == null || (t >= T(7) && t < T(11));
};
const morningEntry = { name: 'モーニングセット', price: 600, heal: 20, fill: 34, stress: 9, desc: 'トースト・ゆで卵・コーヒー。（午前11時まで）', text: '厚切りトーストに、ゆで卵。コーヒーの香りで、一日が始まる。' };
// the seat: has a drink been ordered here today (and how long since)? returns the entry or null
async function orderHere(g, key, o, host) {
  const entries = [...(morning(g) ? [morningEntry] : []), ...drinkEntries(g, !!o.kansai)];
  const e = await orderMenu(g, { title: o.title, entries, host, thanks: pick(THANK), where: o.title });
  if (e) { SS(g).seat = { key, day: g.state.day, t: nowTotal(g) }; }
  return e;
}
function seatPaid(g, key) {
  const s = SS(g).seat;
  if (!s || s.key !== key || s.day !== g.state.day) return false;
  const t = nowTotal(g);
  return t == null || s.t == null || t - s.t <= 180; // one order covers about three hours
}

// ---------------------------------------------------------------- the writing desk
async function writeDesk(g, o, host) {
  if (!seatPaid(g, o.id)) {
    await g.say(host.name === 'マスター' ? '「…ご注文は？」と、マスターが目で言っている。' : '席に座る前に、まず何か頼もう。', who(host));
    const e = await orderHere(g, o.id, o, host);
    if (!e) return;
  }
  if (!has(g, 'writeNeta')) { await g.say('（台本エディタは使えないようだ）'); return; }
  const n = await writeWithSeed(g, {});
  passTime(g, 90, '喫茶店でネタを書く');
  g.state.stamina = Math.max(0, g.state.stamina - 3);
  g.addNeed('stress', n ? 2 : 0);
  await g.say(n ? ['ノートを閉じると、コーヒーがすっかり冷めていた。', `『${n.title || '無題'}』を書き上げた。\n（台本は、ネタ帳に保存された）`] : ['…少し書いたところで、手が止まってしまった。', '書けない日も、ある。\n（また、コーヒーでも飲もう）']);
}
// a script read by a hopeful writer (a coffee for her): the local AI's scoring card
async function readByWriter(g, n, o) {
  const oo = who(n);
  if (!has(g, 'netaList') || !has(g, 'scoreNeta')) { await say(g, n, 'ごめんなさい、いまは忙しくて。'); return; }
  const list = g.netaList() || [];
  if (!list.length) { await say(g, n, ['台本、書いてるの？ 見せて見せて。', '…まだ、ないのね。\n一本できたら、持ってきて。コーヒーおごってくれたらね。']); return; }
  if (dayN(g, 'writer_read') >= 1) { await say(g, n, '今日はもう、見たでしょう。\n頭が、いっぱいよ。続きは、また明日。'); return; }
  const k = await g.ask('台本、見てあげる。\nコーヒー一杯（' + fmtMoney(450) + '）でどう？', ['見てもらう', 'やめておく'], { ...oo, cancel: 1 });
  if (k !== 0) return;
  if (!g.spend(450)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin');
  bumpN(g, 'writer_read');
  const i = await g.list({ title: 'どの台本を見てもらう？', cancel: list.length, items: [...list.slice(0, 8).map((x) => ({ label: x.title || '無題', right: KIND[x.kind] || '' })), { label: 'やめる' }], x: 12, y: 44, w: 440, px: true });
  if (i < 0 || i >= Math.min(8, list.length)) return;
  await say(g, n, ['じゃあ、読むわね。…ふむふむ。']);
  await g.scoreNeta(list[i], { show: true, by: 'local' });
  passTime(g, 30, '台本を見てもらう');
  await say(g, n, ['いろいろ書いたけど、いちばん大事なのは、\n「ここで笑ってほしい」を決めること。', 'それが決まってる台本は、読んでて気持ちいいのよ。']);
}
const KIND = { manzai: '漫才', conte: 'コント', pin: 'ピン', rakugo: '落語', ogiri: '大喜利', utaneta: '歌ネタ', monomane: 'ものまね', talk: 'トーク' };
// read the day's paper: a ネタの種 and a headline-ish line
async function newspaper(g, n) {
  if (dayN(g, 'paper') >= 1) { await g.say('今日の新聞は、もう読んだ。\n（同じ記事を何度読んでも、ネタは増えない）'); return; }
  bumpN(g, 'paper');
  passTime(g, 20, '新聞');
  const t = addSeed(g, byEra(g, { showa: '喫茶店の新聞', any: '新聞の小さな記事' }));
  await g.say([byEra(g, { showa: 'スポーツ新聞をひろげた。\n一面は野球。芸能面の端に、小さく「若手漫才師、人気じわり」とある。', heisei_early: '新聞をひろげた。\n景気の暗い話が続く中、小さな投書欄に、思わず笑える話が載っていた。', heisei: 'スポーツ紙の芸能面をひろげた。\nブログから人気に火がついた、という見出しが目に入った。', reiwa: '紙の新聞は、いまやこういう店にしか置いていない。\n小さな記事の隅に、笑える話が載っていた。' }), t ? `（ネタの種：「${t}」）` : '（めぼしい記事は、なかった）']);
}

// ====================================================================== the cafe builder
function cafe(C) {
  const r = room(C.w, C.h);
  C.build(r);
  r.exit(...C.exits);
  const master = C.master;
  const O = { id: C.id, title: C.name, kansai: !!C.kansai };
  const orderTalk = async (g, n) => {
    const o = who(n);
    const rows = ['注文する', 'ネタを書く席に座る', 'マスターと話す', 'やめておく'];
    const k = await g.ask(C.greet, rows, { ...o, cancel: 3 });
    if (k === 0) await orderHere(g, C.id, O, n);
    else if (k === 1) await writeDesk(g, O, n);
    else if (k === 2) { if (!(await rumorTalk(g, C.id, o, C.talkOpen))) await g.say(C.talkAgain, o); }
  };
  registerShop({
    id: C.id, name: C.name, bgm: C.bgm || 'shop_jazz', hours: C.hours,
    start: { room: 'main', x: C.exits[0], y: C.h - 2, dir: 'up' },
    rooms: {
      main: {
        floor: C.floor, wall: C.wall, tiles: r.rows(), legend: C.legend,
        warps: r.warps(...C.exits),
        entities: [npc(C.id + '_master', C.masterAt[0], C.masterAt[1], 'down', master.look, master.name, orderTalk, { fixedDir: true }), ...C.cast(orderTalk, O)],
        events: [
          { x: C.counter.x, y: C.counter.y, w: C.counter.w, on: 'action', run: (g) => orderTalk(g, master) },
          ...C.events(O, master),
        ],
        onEnter: (g) => firstVisit(g, C.id, C.intro, master),
      },
    },
    crime: false,
  });
}
const CLEG = { C: 'counter', E: 'machi_espresso', k: 'kitchen', F: 'fridge_drinks', t: 'machi_cafetable', c: 'machi_cafechair', D: 'desk', h: 'chair', P: 'plant', B: 'bookshelf', N: 'table', S: 'sofa', W: 'water_server', m: 'wall_wood+machi_menuboard', w: 'wall_wood+window', p: 'wall_wood+poster', l: 'wall_wood+clock', s: 'machi_stool', G: 'magazine', V: 'vending', X: 'machi_cakecase', K: 'shop_chalk', T: 'tv', Z: 'shelf_goods' };

// ====================================================================== 純喫茶 ドット (東京)
const JK_MASTER = { name: '純喫茶のマスター', look: { hair: 'slick', hairColor: 'silver', skin: 'fair', top: '#ffffff', bottom: '#3a2c24', apron: '#5b3a29', beard: true, glasses: true } };
cafe({
  id: 'shop_junkissa', name: '純喫茶 ドット', hours: { spans: [[T(7), T(22)]], note: '' }, w: 12, h: 9, floor: 'floor_wood_dark', wall: 'wood', exits: [5, 6], legend: CLEG, master: JK_MASTER, masterAt: [3, 2],
  greet: 'いらっしゃい。ご注文は？', intro: ['いらっしゃい。…お好きな席へどうぞ。', 'コーヒー一杯で、三時間までなら、ごゆっくり。\nそれ以上は、もう一杯ね。'],
  counter: { x: 1, y: 3, w: 5 },
  talkOpen: ['この店はね、昭和のころから変わっていない。', 'ノートを広げて、ネタを書いてる若者が多いよ。\n…コーヒー一杯で三時間、というのが、まあ、ね。'], talkAgain: 'さっき話したとおりさ。\nコーヒーが冷めるよ。',
  build(r) {
    r.set(2, 1, 'm').set(4, 1, 'w').set(6, 1, 'p').set(8, 1, 'l').set(10, 1, 'w');
    r.set(1, 2, 'k').set(2, 2, 'E').set(4, 2, 'F').set(5, 2, 'X').rect(1, 3, 5, 1, 'C');
    for (const [x, y] of [[8, 3], [8, 6]]) { r.set(x, y, 't').set(x - 1, y, 'c').set(x + 1, y, 'c'); }
    r.set(3, 6, 'D').set(2, 6, 'h').set(4, 6, 'h').set(1, 7, 'P').set(10, 7, 'P').set(10, 2, 'B').set(11, 2, 'B');
  },
  cast: (talk, O) => [
    npc('jk_writer', 7, 6, 'right', { hair: 'long', hairColor: 'black', skin: 'light', top: '#c87a8a', bottom: '#3a3f4a', skirt: true, glasses: true }, '作家志望のお客さん', (g, n) => readByWriter(g, n, O)),
    npc('jk_wakamono', 2, 6, 'right', { ...LOOKS.comedian2, top: '#5a6f8a' }, 'ネタを書く若者', ['コーヒー一杯で三時間…。マスターの目が、ちょっとこわい。', '書けないときは、新聞を読むんだ。\n小さな記事の隅に、ネタの種が落ちてることがあるから。']),
    npc('jk_oji', 10, 5, 'left', { ...LOOKS.oldman, top: '#7a6a5a' }, '常連のおじいさん', ['この店のコーヒーは、町いちばんじゃ。', '昔は、ここで企画会議をやる人がたくさんおった。\n…今は、ノートを広げる若い人ばっかりじゃ。']),
  ],
  events: (O, master) => [
    { x: 3, y: 6, on: 'action', run: (g) => writeDesk(g, O, master) },
    { x: 10, y: 2, w: 2, on: 'action', run: (g) => newspaper(g) },
    { x: 5, y: 2, on: 'action', run: (g) => g.say('ケーキのショーケースだ。\n今日は、プリンとチーズケーキ。') },
  ],
});

// ====================================================================== カフェ (東京 劇場通り) — 読み合わせ席
const CT_MASTER = { name: 'カフェの店員さん', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#ffffff', bottom: '#2f6a4a', apron: '#2f6a4a', skirt: true } };
async function yomiawase(g, o) {
  if (!seatPaid(g, o.id)) {
    await g.say('読み合わせ席は、ご注文のお客さまに。\n（まず、何か頼もう）');
    const e = await orderHere(g, o.id, o, CT_MASTER);
    if (!e) return;
  }
  let u = null;
  try { u = has(g, 'unit') ? g.unit() : null; } catch (e) { u = null; }
  const hasPartner = !!(u && u.type !== 'pin');
  const rows = [hasPartner ? '相方と読み合わせる（ネタ合わせ）' : null, 'ひとりで台本を読む', 'やめる'].filter(Boolean);
  const k = await g.ask('読み合わせ席だ。台本を広げよう。', rows, { cancel: rows.length - 1 });
  const pick1 = rows[k];
  if (pick1 === 'やめる' || k < 0) return;
  if (pick1.startsWith('相方')) {
    if (has(g, 'owaraiPractice')) { await g.owaraiPractice('awase', { skipCheck: true, quiet: true }); passTime(g, 60, '読み合わせ'); }
  } else {
    const list = has(g, 'netaList') ? g.netaList() || [] : [];
    if (!list.length) { await g.say('台本が、まだない。\n（純喫茶のネタを書く席で、一本書いてみよう）'); return; }
    const i = await g.list({ title: 'どの台本を読む？', cancel: list.length, items: [...list.slice(0, 8).map((x) => ({ label: x.title || '無題', right: `仕上がり ${Math.round(x.practice || 0)}` })), { label: 'やめる' }], x: 12, y: 44, w: 440, px: true });
    if (i < 0 || i >= Math.min(8, list.length)) return;
    const r = has(g, 'netaRehearse') ? await g.netaRehearse(list[i].id) : null;
    if (!r || !r.ok) { await g.say(r && r.why ? r.why : '（いまは、できないようだ）'); return; }
    passTime(g, 45, '読み合わせ');
    await g.say([`声に出して、台本を頭から通した。`, `『${list[i].title || '無題'}』の仕上がり ${r.before} → ${r.after}\n（今日はあと${r.left}回できる）`]);
  }
}
cafe({
  id: 'shop_cafe_t', name: 'カフェ（劇場通り）', hours: { spans: [[T(9), T(21)]], note: '' }, w: 11, h: 8, bgm: 'machi_cafe', floor: 'floor_wood', wall: 'green', exits: [5], legend: { ...CLEG, m: 'wall_green+machi_menuboard', w: 'wall_green+window', p: 'wall_green+poster', l: 'wall_green+clock' }, master: CT_MASTER, masterAt: [3, 2],
  greet: 'いらっしゃいませ。ご注文は、カウンターでどうぞ。', intro: ['いらっしゃいませ。劇場通りのカフェへようこそ。', '奥の席は、読み合わせ席。\n台本を広げるお客さんが、多いんですよ。'],
  counter: { x: 1, y: 3, w: 4 },
  talkOpen: ['ここ、劇場が近いから、芸人さんも役者さんもよく来るんです。', '台本を読み合わせる声が、ときどき聞こえてきて。\n…ちょっと、うらやましいです。'], talkAgain: 'さっきお話ししたとおりです。\nごゆっくり。',
  build(r) {
    r.set(2, 1, 'm').set(4, 1, 'w').set(7, 1, 'p').set(9, 1, 'l');
    r.set(1, 2, 'k').set(2, 2, 'E').set(5, 2, 'X').rect(1, 3, 4, 1, 'C');
    for (const [x, y] of [[8, 3], [8, 5]]) { r.set(x, y, 't').set(x - 1, y, 'c').set(x + 1, y, 'c'); }
    r.set(2, 5, 'N').set(1, 5, 'h').set(3, 5, 'h').set(2, 6, 'h').set(9, 6, 'P').set(1, 2, 'P');
  },
  cast: () => [
    npc('ct_duo1', 1, 5, 'right', { ...LOOKS.comedian, top: '#2f6fd0' }, '台本を読み合わせる二人組', ['…「ちょっと待って、それ俺のセリフ」「いや、おまえのセリフやない」', '…あ、すみません。声、大きかったですか？']),
    npc('ct_duo2', 3, 5, 'left', { ...LOOKS.comedian2, top: '#ff8a3d' }, '台本を読み合わせる二人組', ['この席、読み合わせにちょうどいいんだ。\n壁が厚くて、声が漏れにくい。', 'あと、コンセントがあるのが、ありがたい。']),
    npc('ct_actor', 9, 4, 'left', { ...LOOKS.actor, top: '#3a3f4a' }, '役者の卵', ['オーディションの帰りなんだ。\n…手応え？ それは、結果が出るまで、わからない。', 'こういうときは、甘いものを頼む。\nそう決めてる。']),
  ],
  events: (O) => [
    { x: 2, y: 5, on: 'action', run: (g) => yomiawase(g, O) },
    { x: 5, y: 2, on: 'action', run: (g) => g.say('ケーキのショーケースだ。\nタルトとシフォンケーキが並んでいる。') },
  ],
});

// ====================================================================== 純喫茶 ドット (なんば)
const JN_MASTER = { name: '純喫茶のママ', look: { hair: 'bob', hairColor: 'silver', skin: 'fair', top: '#ffffff', bottom: '#8a3a4a', apron: '#d8c8a0', skirt: true } };
cafe({
  id: 'shop_junkissa_n', name: '純喫茶 ドット（なんば）', hours: { spans: [[T(7), T(21)]], note: '' }, w: 12, h: 9, kansai: true, floor: 'floor_wood_dark', wall: 'wood', exits: [5, 6], legend: CLEG, master: JN_MASTER, masterAt: [3, 2],
  greet: 'いらっしゃい。なににしましょ。', intro: ['いらっしゃい。純喫茶ドットへ、ようこそ。', '朝は、モーニングやで。トーストと卵と、コーヒー。'],
  counter: { x: 1, y: 3, w: 5 },
  talkOpen: ['ミックスジュースは、うちの名物やねん。', '劇場帰りの芸人さんが、よう来はる。\n…ウケへんかった日の顔は、すぐ分かるわ。'], talkAgain: 'さっきも話したやろ。\nジュースがぬるなるで。',
  build(r) {
    r.set(2, 1, 'm').set(4, 1, 'w').set(6, 1, 'p').set(8, 1, 'l').set(10, 1, 'w');
    r.set(1, 2, 'k').set(2, 2, 'E').set(4, 2, 'F').set(5, 2, 'X').rect(1, 3, 5, 1, 'C');
    for (const [x, y] of [[8, 3], [8, 6], [3, 6]]) { r.set(x, y, 't').set(x - 1, y, 'c').set(x + 1, y, 'c'); }
    r.set(1, 7, 'P').set(10, 7, 'P').set(10, 2, 'B').set(11, 2, 'G');
  },
  cast: (talk, O) => [
    npc('jn_shogi1', 7, 6, 'right', { ...LOOKS.oldman, top: '#7a8a6a' }, '将棋のおじいさん', async (g, n) => {
      if (dayN(g, 'shogi') >= 1) { await say(g, n, '今日はもう、一局やったやろ。\nわしの勝ち越しや。ええな。'); return; }
      const k = await g.ask('一局、やるか？ 将棋は、頭の体操や。', ['一局指す', 'やめておく'], { ...who(n), cancel: 1 });
      if (k !== 0) return;
      bumpN(g, 'shogi');
      passTime(g, 45, '将棋');
      const win = Math.random() < 0.3;
      g.relax({ stress: win ? 10 : 6 });
      const t = addSeed(g, '将棋のおじいさんの話');
      await g.say([win ? 'おっ、勝った！ おじいさんが、うなった。\n「やるな、あんた！」' : '負けた…。「まだまだやな。ほっほっほ」', `（ストレス -${win ? 10 : 6}）${t ? `\n（おじいさんの昔話から、ネタの種を拾った：「${t}」）` : ''}`]);
    }),
    npc('jn_shogi2', 9, 6, 'left', { ...LOOKS.oldman, top: '#8a6a4a' }, 'もうひとりのおじいさん', ['昔はな、この辺りの劇場に、毎日来とった。', '芸人の顔を見たら、そいつがいくつまで生きられるか、\nなんとなく分かる…気がするんや。']),
    npc('jn_gakusei', 2, 6, 'right', { ...LOOKS.comedian, top: '#e8492a', hairColor: 'black' }, 'NSC生', ['ネタ見せのまえは、ここでミックスジュースや。', '安いし、おいしいし、ママも優しい。\n…たまに、ネタも見てくれる。']),
  ],
  events: (O, master) => [
    { x: 3, y: 6, on: 'action', run: (g) => writeDesk(g, O, master) },
    { x: 10, y: 2, w: 2, on: 'action', run: (g) => newspaper(g) },
  ],
});

// ====================================================================== カラオケ (hourly rooms)
const PRICE_H = 800;
const SONGS = [
  { name: 'ぽかぽか日だまりバラード', label: 'しっとりバラード', difficulty: 1, lanes: 1, desc: 'ゆったりしたテンポ。初心者にもおすすめ。' },
  { name: '夏色サイダー', label: 'アイドルソング', difficulty: 2, lanes: 2, desc: '元気いっぱいのアイドルソング。' },
  { name: 'ネオンシティ・ロック', label: 'ロックナンバー', difficulty: 3, lanes: 4, desc: 'ノリノリのロック。ちょっとむずかしい。' },
  { name: '早口ことばラプソディ', label: '早口ソング', difficulty: 4, lanes: 4, desc: '舌をかみそうな早口ソング。上級者向け！' },
];
const bookedUntil = (g) => { const b = SS(g).kara; return b && b.day === g.state.day ? b : null; };
const minutesLeft = (g, B) => { const t = nowTotal(g); return t == null ? B.left : Math.max(0, B.until - t); };
async function karaBook(g, K, n) {
  const o = who(n);
  const B = bookedUntil(g);
  const t = nowTotal(g);
  if (B && B.id === K.id && minutesLeft(g, B) > 0) { await g.say([`${B.room}号室ですね。残りは ${minutesLeft(g, B)}分です。`, '奥のドアから、どうぞ。'], o); return true; }
  const k = await g.ask(K.greet, ['1時間', '2時間', '3時間', 'やめておく'], { ...o, cancel: 3 });
  if (k < 0 || k > 2) { await g.say(K.bye, o); return false; }
  const h = k + 1;
  const price = Math.round(PRICE_H * h * (h === 3 ? 0.9 : 1) / 10) * 10 + 0; // ワンドリンクつき、3時間は1割引
  const k2 = await g.ask(`${h}時間で ${fmtMoney(price)}（ワンドリンクつき）です。`, ['おねがいします', 'やめておく'], { ...o, cancel: 1 });
  if (k2 !== 0) return false;
  if (!g.spend(price)) { await g.say('お金が足りない…。', o); return false; }
  g.sfx('coin');
  const room = 1 + Math.floor(Math.random() * 9);
  SS(g).kara = { id: K.id, day: g.state.day, until: (t == null ? 0 : t) + h * 60, left: h * 60, room, songs: 0 };
  await g.say([`${room}号室です。奥のドアからどうぞ。`, '（時間は、歌ったり練習したりするたびに減る）'], o);
  return true;
}
// one thing in the room: costs minutes; when the time is up, the phone rings
async function karaUse(g, K, mins, fn) {
  const B = bookedUntil(g);
  if (!B || B.id !== K.id) { await g.say('（受付をすませてから使おう）'); return false; }
  const left = minutesLeft(g, B);
  if (left <= 0) { await g.say(['プルルル…。', '「お時間になりました。延長なさいますか？」\n（受付で、もう一度お願いしよう）']); return false; }
  const ok = await fn(g, B);
  if (ok === false) return false;
  passTime(g, mins, 'カラオケ');
  if (nowTotal(g) == null) B.left = Math.max(0, B.left - mins);
  const l2 = minutesLeft(g, B);
  if (l2 <= 10 && l2 > 0 && has(g, 'notify')) g.notify(`あと${l2}分で、お時間です`, { color: '#ffd23f' });
  if (l2 <= 0) await g.say(['プルルル…。', '「お時間になりました。延長なさいますか？」\n（受付で、もう一度お願いしよう）']);
  return true;
}
async function karaSing(g, K) {
  if (g.state.stamina < 5) { await g.say('体力が足りない…。\nのどもカラカラだ。少し休もう。'); return; }
  const i = await g.list({
    title: '曲をえらぶ（体力 -5・5分）', cancel: -1,
    items: SONGS.map((s) => ({ label: s.label, right: '★'.repeat(s.difficulty) })),
    x: 12, y: 44, w: 340, px: true, describe: (j) => `「${SONGS[j].name}」\n${SONGS[j].desc}`,
  });
  if (i < 0) return;
  const s = SONGS[i];
  await karaUse(g, K, 5, async (gg, B) => {
    g.useStamina(5);
    const res = await g.minigame('rhythm', { difficulty: s.difficulty, lanes: s.lanes, song: s.name, title: 'カラオケ', skill: 'uta' });
    const good = 'SAB'.includes(res.rank);
    B.songs = (B.songs || 0) + 1;
    const n = bumpN(g, 'kara_songs');
    g.relax({ stress: (good ? [24, 14, 8, 4] : [10, 6, 3, 2])[Math.min(3, n - 1)] });
    const lines = [`採点結果…${res.score}点！（ランク${res.rank}）`, res.rank === 'S' ? '画面に「プロ級！」の文字が光った！' : good ? 'いい感じに歌えた！ 声を出すって、気持ちいい！' : 'うーん、音程がちょっと…。でも、すっきりした！'];
    if (good && n <= 3) { g.addSkill('uta', 1, true); lines.push('歌 +1'); } else if (good) lines.push('（今日はたくさん歌った。歌の練習効果は、また明日）');
    g.sfx(good ? 'applause' : 'cursor');
    await g.say(lines);
  });
}
async function karaVoice(g, K) {
  if (!has(g, 'owaraiPractice')) { await g.say('（声出しの練習は、いまはできないようだ）'); return; }
  await karaUse(g, K, 40, async () => { const r = await g.owaraiPractice('hassei', { skipCheck: true, quiet: true }); return !!r; });
}
async function karaNeta(g, K) {
  let u = null;
  try { u = has(g, 'unit') ? g.unit() : null; } catch (e) { u = null; }
  const partner = !!(u && u.type !== 'pin');
  if (partner) {
    if (!has(g, 'owaraiPractice')) return;
    const r = await karaUse(g, K, 60, async () => { const x = await g.owaraiPractice('awase', { skipCheck: true, quiet: true }); return !!x; });
    return r;
  }
  const list = has(g, 'netaList') ? g.netaList() || [] : [];
  if (!list.length) { await g.say('台本が、まだない。\n（純喫茶のネタを書く席で、一本書いてみよう）'); return; }
  const i = await g.list({ title: 'どの台本を声に出す？（45分）', cancel: list.length, items: [...list.slice(0, 8).map((x) => ({ label: x.title || '無題', right: `仕上がり ${Math.round(x.practice || 0)}` })), { label: 'やめる' }], x: 12, y: 44, w: 440, px: true });
  if (i < 0 || i >= Math.min(8, list.length)) return;
  await karaUse(g, K, 45, async () => {
    const r = has(g, 'netaRehearse') ? await g.netaRehearse(list[i].id) : null;
    if (!r || !r.ok) { await g.say(r && r.why ? r.why : '（いまは、できないようだ）'); return false; }
    await g.say([`防音の個室で、台本を声に出して通した。`, `『${list[i].title || '無題'}』の仕上がり ${r.before} → ${r.after}\n（今日はあと${r.left}回できる）`]);
    return true;
  });
}
function karaoke(K) {
  const lobby = room(10, 8);
  lobby.set(2, 1, 'p').set(4, 1, 'w').set(6, 1, 'p').set(8, 1, 'd').rect(2, 3, 3, 1, 'R').set(1, 5, 'S').set(2, 5, 'S').set(8, 5, 'D').set(1, 3, 'P').exit(4);
  const booth = room(10, 8);
  booth.set(2, 1, 'p').set(5, 1, 'p').set(1, 2, 'K').set(8, 2, 'K').set(4, 2, 'm').rect(2, 4, 2, 1, 'B').set(5, 4, 't').set(6, 4, 't').rect(7, 4, 2, 1, 'B').exit(4);
  const desk = (g, n) => karaBook(g, K, n);
  registerShop({
    id: K.id, name: K.name, bgm: 'night', hours: K.hours,
    start: { room: 'lobby', x: 4, y: 6, dir: 'up' },
    rooms: {
      lobby: {
        floor: 'floor_carpet_purple', wall: 'purple', tiles: lobby.rows(),
        legend: { p: 'wall_purple+poster', w: 'wall_purple+window', d: 'door_wood', R: 'counter_white', S: 'sofa_blue', D: 'machi_drinkbar', P: 'plant' },
        warps: [...lobby.warps(4), { x: 8, y: 1, room: 'booth', tx: 4, ty: 5, dir: 'up', check: async (g) => { const B = bookedUntil(g); if (B && B.id === K.id && minutesLeft(g, B) > 0) return true; await g.say('（個室に入る前に、受付をすませよう）'); return false; } }],
        entities: [
          npc(K.id + '_clerk', 3, 2, 'down', K.clerk.look, K.clerk.name, desk, { fixedDir: true }),
          ...K.cast,
        ],
        events: [
          { x: 2, y: 3, w: 3, on: 'action', run: (g) => desk(g, K.clerk) },
          { x: 8, y: 4, on: 'action', run: (g) => g.say(['ドリンクバーだ。', 'ワンドリンクつきの会計だけど、ここは飲み放題でもあるらしい。']) },
        ],
        onEnter: (g) => firstVisit(g, K.id, K.intro, K.clerk),
      },
      booth: {
        floor: 'floor_carpet_purple', wall: 'dark', bgm: 'night', tiles: booth.rows(),
        legend: { p: 'wall_dark+poster', K: 'speaker', m: 'mic', B: 'sofa', t: 'table_low', M: 'exit_mat' },
        warps: [{ x: 4, y: 7, room: 'lobby', tx: 8, ty: 2, dir: 'down' }],
        entities: [],
        events: [
          { x: 4, y: 2, on: 'action', run: async (g) => { const rows = ['歌う', '声出し（発声練習）', 'ネタ合わせ・読み上げ', 'やめる']; const B = bookedUntil(g); const k = await g.ask(`${B ? B.room + '号室' : '個室'}だ。残り時間：${B ? minutesLeft(g, B) : 0}分`, rows, { cancel: 3 }); if (k === 0) await karaSing(g, K); else if (k === 1) await karaVoice(g, K); else if (k === 2) await karaNeta(g, K); } },
          { x: 2, y: 3, w: 2, on: 'action', run: (g) => g.say('ふかふかのソファだ。\nテーブルの上に、タンバリンとマラカスがある。') },
        ],
        drawOver: undefined,
        onEnter: async (g) => { if (!SS(g).met[K.id + '_booth']) { SS(g).met[K.id + '_booth'] = 1; await g.wait(200); await g.say('うす暗い部屋に、ミラーボールが回っている。\nマイクの前でAボタン → 歌う・練習する。'); } },
      },
    },
    crime: false,
  });
}
karaoke({
  id: 'shop_karaoke_t', name: 'カラオケ（芸人通り）', hours: { spans: [[T(10), T(26)]], note: '' },
  clerk: { name: 'カラオケの店員さん', look: { hair: 'spiky', hairColor: 'blonde', skin: 'fair', top: '#8a5ac8', bottom: '#2a2430' } },
  greet: 'いらっしゃいませ！ 何時間にしますか？', bye: 'また来てくださいね〜！', intro: ['いらっしゃいませ！ カラオケへようこそ！', '時間制の個室です。歌うだけじゃなくて、\nネタ合わせや声出しに使う芸人さんも多いんですよ。'],
  cast: [
    npc('kt_geinin', 6, 4, 'left', { ...LOOKS.comedian, top: '#ff7eb6' }, 'ネタ合わせ帰りの芸人', ['個室でネタ合わせすると、声を出しても、だれにも気づかれない。', '時間制だから、ダラダラやらなくて済むのもいい。\n…あと、ドリンクバーが、ありがたい。']),
    npc('kt_band', 7, 5, 'up', { hair: 'spiky', hairColor: 'red', skin: 'fair', top: '#20232a', bottom: '#3a4a7a' }, 'バンドマン', ['ここで毎日、声出しの練習してんだ。', 'うまく歌えた日は、気分がいいぜ。']),
  ],
});
karaoke({
  id: 'shop_karaoke_n', name: 'カラオケ（なんば）', hours: { spans: [[T(10), T(26)]], note: '' },
  clerk: { name: 'カラオケの店員さん', look: { hair: 'short', hairColor: 'brown', skin: 'tan', top: '#d62f2f', bottom: '#2a2430' } },
  greet: 'いらっしゃい！ なんぼ時間つかう？', bye: 'ほな、またな！', intro: ['いらっしゃい！ カラオケへようこそ！', '時間制やで。ワンドリンクつきや。\nネタ合わせに使う芸人も、多いんよ。'],
  cast: [
    npc('kn_nsc', 6, 4, 'left', { ...LOOKS.comedian, top: '#e8492a', hairColor: 'black' }, 'NSC生', ['ネタ見せのまえは、ここで一人で通すんや。', '壁が厚いさかい、声ぎょうさん出しても平気や。']),
    npc('kn_oba', 7, 5, 'up', { ...LOOKS.oldwoman, top: '#ff7eb6', hairColor: 'purple' }, '歌好きのおばちゃん', ['歌はな、心の洗濯や。', '嫌なことあったら、大きな声で歌うんが、いちばんやで。']),
  ],
});
